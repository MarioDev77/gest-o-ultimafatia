import type { Pool, PoolClient } from "pg"
import { ApiError } from "../lib/errors"

// Mantido como alias pra não quebrar quem já importa SalesServiceError.
export const SalesServiceError = ApiError

type SaleItemInput = {
  productId: string
  quantity: number
  unitPriceCents?: number
}

export type CreateSaleInput = {
  items: SaleItemInput[]
  customerName: string | null
  paymentMethod: "dinheiro" | "pix" | "cartao"
  amountReceivedCents: number | null
  discountCents: number
  notes: string | null
  weekId: string | null
  createdBy: string
}

// Todo o cálculo financeiro (preço, custo, troco) é resolvido aqui a partir do
// banco de dados, nunca confiando em valores enviados pelo frontend — só o
// product_id e a quantidade vêm do cliente; preço/custo padrão vêm do produto.
// A venda inteira roda numa única transação: se qualquer item falhar (estoque
// insuficiente, produto inativo, produto sem preço), nada é gravado.
export async function createSale(pool: Pool, input: CreateSaleInput) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    if (input.weekId) {
      const week = await client.query("SELECT id FROM sale_weeks WHERE id = $1 AND deleted_at IS NULL", [input.weekId])
      if (!week.rows[0]) throw new SalesServiceError("Semana não encontrada", 404)
    }

    let subtotalCents = 0
    let totalCostCents = 0
    const resolvedItems: Array<{
      productId: string
      productName: string
      quantity: number
      unitPriceCents: number
      unitCostCents: number
      lineTotalCents: number
      costMissing: boolean
    }> = []

    for (const item of input.items) {
      // FOR UPDATE trava a linha do produto até o fim da transação, evitando
      // duas vendas simultâneas venderem o mesmo estoque em corrida.
      const { rows } = await client.query(
        `SELECT id, name, sale_price_cents, manufacturing_cost_cents, stock_quantity, status
         FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [item.productId]
      )
      const product = rows[0]
      if (!product) throw new SalesServiceError(`Produto não encontrado (${item.productId})`, 404)
      if (product.status !== "ativo") throw new SalesServiceError(`Produto "${product.name}" está inativo`, 409)
      if (product.stock_quantity < item.quantity) {
        throw new SalesServiceError(
          `Estoque insuficiente para "${product.name}" (disponível: ${product.stock_quantity})`,
          409
        )
      }

      const unitPriceCents = item.unitPriceCents ?? product.sale_price_cents
      if (unitPriceCents === null || unitPriceCents === undefined) {
        throw new SalesServiceError(`Produto "${product.name}" ainda não tem preço de venda cadastrado`, 422)
      }

      const costMissing = product.manufacturing_cost_cents === null
      const unitCostCents = product.manufacturing_cost_cents ?? 0
      const lineTotalCents = unitPriceCents * item.quantity

      subtotalCents += lineTotalCents
      totalCostCents += unitCostCents * item.quantity

      resolvedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents,
        unitCostCents,
        lineTotalCents,
        costMissing,
      })

      await client.query(
        "UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2",
        [item.quantity, product.id]
      )
    }

    const discountCents = input.discountCents
    if (discountCents > subtotalCents) {
      throw new SalesServiceError("Desconto não pode ser maior que o subtotal", 400)
    }
    const totalCents = subtotalCents - discountCents

    let amountReceivedCents: number | null = null
    let changeCents = 0
    if (input.paymentMethod === "dinheiro") {
      if (input.amountReceivedCents === null) {
        throw new SalesServiceError("Informe o valor recebido em dinheiro", 400)
      }
      if (input.amountReceivedCents < totalCents) {
        throw new SalesServiceError("Valor recebido é menor que o total da venda", 400)
      }
      amountReceivedCents = input.amountReceivedCents
      changeCents = amountReceivedCents - totalCents
    }

    const saleResult = await client.query(
      `INSERT INTO sales (customer_name, payment_method, amount_received_cents, change_cents, discount_cents, subtotal_cents, total_cents, total_cost_cents, notes, created_by, week_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, sale_number, sale_datetime`,
      [
        input.customerName,
        input.paymentMethod,
        amountReceivedCents,
        changeCents,
        discountCents,
        subtotalCents,
        totalCents,
        totalCostCents,
        input.notes,
        input.createdBy,
        input.weekId,
      ]
    )
    const sale = saleResult.rows[0]

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name_snapshot, quantity, unit_price_cents, unit_cost_cents, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sale.id, item.productId, item.productName, item.quantity, item.unitPriceCents, item.unitCostCents, item.lineTotalCents]
      )
    }

    await client.query("COMMIT")

    return {
      id: sale.id,
      saleNumber: sale.sale_number,
      saleDatetime: sale.sale_datetime,
      customerName: input.customerName,
      paymentMethod: input.paymentMethod,
      subtotalCents,
      discountCents,
      totalCents,
      totalCostCents,
      amountReceivedCents,
      changeCents,
      weekId: input.weekId,
      status: "concluida" as const,
      items: resolvedItems,
      costWarning: resolvedItems.some((i) => i.costMissing),
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

// Cancelar devolve o estoque reservado pela venda. Não apaga o registro —
// mantém o histórico com status "cancelada" pra não sumir do relatório financeiro.
export async function cancelSale(pool: Pool, saleId: string) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const { rows } = await client.query(
      "SELECT id, status FROM sales WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [saleId]
    )
    const sale = rows[0]
    if (!sale) throw new SalesServiceError("Venda não encontrada", 404)
    if (sale.status === "cancelada") throw new SalesServiceError("Venda já está cancelada", 409)

    const { rows: items } = await client.query(
      "SELECT product_id, quantity FROM sale_items WHERE sale_id = $1",
      [saleId]
    )
    for (const item of items) {
      await client.query(
        "UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2",
        [item.quantity, item.product_id]
      )
    }

    await client.query("UPDATE sales SET status = 'cancelada', updated_at = NOW() WHERE id = $1", [saleId])
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

// Devolve o estoque reservado por uma venda e apaga o registro de vez
// (sale_items some junto, via ON DELETE CASCADE da FK). Diferente de
// cancelSale: aqui a venda some do histórico, sem deixar rastro. Só deve
// ser chamada a partir de uma operação explícita de limpeza (excluir
// semana com vendas, apagar todas as vendas) — nunca automaticamente.
async function hardDeleteSaleTx(client: PoolClient, saleId: string) {
  const { rows: items } = await client.query(
    "SELECT product_id, quantity FROM sale_items WHERE sale_id = $1",
    [saleId]
  )
  for (const item of items) {
    await client.query(
      "UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2",
      [item.quantity, item.product_id]
    )
  }
  await client.query("DELETE FROM sales WHERE id = $1", [saleId])
}

// Apaga de vez todas as vendas ligadas a uma semana (devolvendo estoque de
// cada uma). Usada ao excluir uma semana que já tem vendas registradas —
// antes disso, a exclusão da semana era bloqueada.
export async function deleteSalesByWeek(pool: Pool, weekId: string) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const { rows: sales } = await client.query(
      "SELECT id FROM sales WHERE week_id = $1 AND deleted_at IS NULL FOR UPDATE",
      [weekId]
    )
    for (const sale of sales) {
      await hardDeleteSaleTx(client, sale.id)
    }
    await client.query("COMMIT")
    return sales.length
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

// Apaga de vez todas as vendas do sistema (reset), devolvendo o estoque
// reservado por cada uma. Ação irreversível, usada pelo botão "Apagar
// todas as vendas" da aba Vendas.
export async function deleteAllSales(pool: Pool) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const { rows: sales } = await client.query("SELECT id FROM sales WHERE deleted_at IS NULL FOR UPDATE")
    for (const sale of sales) {
      await hardDeleteSaleTx(client, sale.id)
    }
    await client.query("COMMIT")
    return sales.length
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
