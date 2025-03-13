'use server'

import db from "@/db/drizzle"
import { customers, invoices, revenue } from "@/db/schema"
import { count, sql, eq, desc, ilike, or } from "drizzle-orm"
import { formatCurrency } from "../utils"
import { revalidatePath } from "next/cache"
import { ITEMS_PER_PAGE } from "../constants"
import { z } from "zod"
import { redirect } from "next/navigation"
import { InvoiceForm } from "@/types"

export async function fetchCarData() {
    try {
        const invoiceCountPromise = db.select({ count: count() }).from(invoices)
        const customerCountPromise = db.select({ count: count() }).from(customers)
        const invoiceStatusPromise = db
            .select({
                paid: sql<number>`SUM(CASE WHEN status = 'paid' then amount ELSE 0 END)`,
                pending: sql<number>`SUM(CASE WHEN status = 'pending' then amount ELSE 0 END)`,
            })
            .from(invoices)

        const data = await Promise.all([
            invoiceCountPromise,
            customerCountPromise,
            invoiceStatusPromise,
        ])

        const numberOfInvoices = Number(data[0][0].count ?? '0')
        const numberOfCustomers = Number(data[1][0].count ?? '0')
        const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0')
        const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0')

        return {
            numberOfCustomers,
            numberOfInvoices,
            totalPaidInvoices,
            totalPendingInvoices,
        }
    } catch(error) {
        console.error('Database error:', error)
        throw new Error('Failed to fetch card data.')
    }
}

export async function fetchRevenue() {
    try{
        const data=await db.select().from(revenue)
        return data
    }catch(error){
        console.error('Database error:', error)
        throw new Error('Failed to fetch the revenues.')
    }
}

export async function fetchLatestInvoices() {
    try {
        const data = await db
            .select({
                amount: invoices.amount,
                name: customers.name,
                image_url: customers.image_url,
                email: customers.email,
                id: invoices.id,
            })
            .from(invoices)
            .innerJoin(customers, eq(invoices.customer_id, customers.id))
            .orderBy(desc(invoices.date))
            .limit(5)

        const latestInvoices = data.map((invoice) => ({
            ...invoice,
            amount: formatCurrency(invoice.amount),
        }))

        return latestInvoices
    } catch(error) {
        console.error('Database Error:', error)
        throw new Error('Failed to fetch the latest invoices.')
    }
}

export async function deleteInvoice(id: string) {
    try {
      await db.delete(invoices).where(eq(invoices.id, id))
      revalidatePath('/dashboard/invoices')
      //return { message: 'Deleted Invoice' }
    } catch (error) {
      //return { message: `Database Error: Failed to Delete Invoice. ${error}` }
      throw new Error(`${error}`)
    }
  }

export async function fetchFilteredInvoices(query: string, currentPage: number){
    const offset = (currentPage - 1) * ITEMS_PER_PAGE
    try {
        const data = await db
            .select({
                id: invoices.id,
                amount: invoices.amount,
                name: customers.name,
                email: customers.email,
                image_url: customers.image_url,
                status: invoices.status,
                date: invoices.date,
            })
            .from(invoices)
            .innerJoin(customers, eq(invoices.customer_id, customers.id))
            .where(
                or(
                    ilike(customers.name, sql`${`%${query}%`}`),
                    ilike(customers.email, sql`${`%${query}%`}`),
                    ilike(invoices.status, sql`${`%${query}%`}`)
                )
            )
            .orderBy(desc(invoices.date))
            .limit(ITEMS_PER_PAGE)
            .offset(offset)
        
        return data
    } catch(error) {
        console.error('Database Error:', error)
        throw new Error('Failed to fetch invoides.')
    }
}

export async function fetchInvoicesPages(query: string){
    try {
        const data = await db
            .select({
                count: count(),
            })
            .from(invoices)
            .innerJoin(customers, eq(invoices.customer_id, customers.id))
            .where(
                or(
                    ilike(customers.name, sql`${`%${query}%`}`),
                    ilike(customers.email, sql`${`%${query}%`}`),
                    ilike(invoices.status, sql`${`%${query}%`}`)
                )
            )
        const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE)
        
        return totalPages
    } catch(error) {
        console.error('Database Error:', error)
        throw new Error('Failed to fetch total number of invoices.')
    }
}

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, {message: 'Please enter an amount greater than 0.'}),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select a status.',
    }),
    date: z.string(),
})
const CreateInvoice = FormSchema.omit({ id: true, date: true })
const UpdateInvoice = FormSchema.omit({ date: true, id: true })

export type State = {
    errors?: {
        customerId?: string[]
        amount?: string[]
        status?: string[]
    }
    message?: string | null
}

export async function createInvoice(prevState: State, formData: FormData){
    const validateFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: Number(formData.get('amount')),
        status: formData.get('status'),
    })

    if(!validateFields.success){
        return {
            errors: validateFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        }
    }

    const { customerId, amount, status } = validateFields.data
    const amountInCents = amount * 100
    const date = new Date().toISOString().split('T')[0]

    try {
        await db.insert(invoices).values({
            customer_id: customerId,
            amount: amountInCents,
            status,
            date,
        })
    }catch(error){
        return {
            message: `Database Error: Failed to Create Invoice. ${error}`
        }
    }
    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function updateInvoice(
    id: string,
    prevState: State,
    formData: FormData
){
    const validateFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: Number(formData.get('amount')),
        status: formData.get('status'),
    })

    if(!validateFields.success){
        return {
            errors: validateFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        }
    }

    const { customerId, amount, status} = validateFields.data
    const amountInCents = amount * 100

    try {
        await db
            .update(invoices)
            .set({
                customer_id: customerId,
                amount: amountInCents,
                status,
            })
            .where(eq(invoices.id, id))
    }catch(error){
        return { message: `Database Error: Faile to update Invoice. ${error}`}
    }
    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function fetchInvoiceById(id: string) {
    try {
      const data = await db
        .select({
          id: invoices.id,
          customer_id: invoices.customer_id,
          amount: invoices.amount,
          status: invoices.status,
          date: invoices.date,
        })
        .from(invoices)
        .where(eq(invoices.id, id))
  
      const invoice = data.map((invoice) => ({
        ...invoice,
        // Convert amount from cents to dollars
        status: invoice.status === 'paid' ? 'paid' : 'pending',
        amount: invoice.amount / 100,
      }))
  
      return invoice[0] as InvoiceForm
    } catch (error) {
      console.error('Database Error:', error)
      throw new Error('Failed to fetch invoice.')
    }
  }