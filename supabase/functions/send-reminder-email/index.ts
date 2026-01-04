import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@4.0.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendReminderEmailRequest {
  invoice_id: string
}

// Simple HTML template function for payment reminders
function generateReminderEmailHtml(props: {
  customerName: string
  invoiceNumber: string
  balanceDue: string
  dueDate?: string
  daysOverdue?: number
  publicUrl: string
  businessName: string
  businessEmail?: string
  businessPhone?: string
  canPayOnline: boolean
}): string {
  const isOverdue = props.daysOverdue && props.daysOverdue > 0
  const buttonColor = isOverdue ? '#dc2626' : '#059669'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 20px;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; margin: 0 0 24px; text-align: center;">${props.businessName}</h1>
    
    ${isOverdue ? `
    <div style="background-color: #fef2f2; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px; text-align: center;">
      <p style="color: #dc2626; font-size: 14px; font-weight: 600; margin: 0;">⚠️ ${props.daysOverdue} ${props.daysOverdue === 1 ? 'day' : 'days'} overdue</p>
    </div>
    ` : ''}
    
    <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 16px 0;">Hi ${props.customerName},</p>
    
    <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 16px 0;">
      This is a friendly reminder that invoice <strong>${props.invoiceNumber}</strong> ${isOverdue ? 'is now overdue' : 'is due soon'}.
      ${props.canPayOnline ? ' You can pay securely online using the button below.' : ' Please arrange payment at your earliest convenience.'}
    </p>
    
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Invoice Number</p>
      <p style="color: #1a1a1a; font-size: 16px; font-weight: 500; margin: 0;">${props.invoiceNumber}</p>
      
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Balance Due</p>
      <p style="color: #1a1a1a; font-size: 28px; font-weight: 700; margin: 0;">${props.balanceDue}</p>
      
      ${props.dueDate ? `
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Due Date</p>
      <p style="color: ${isOverdue ? '#dc2626' : '#1a1a1a'}; font-size: 16px; font-weight: 500; margin: 0;">${props.dueDate}</p>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${props.publicUrl}" style="background-color: ${buttonColor}; border-radius: 6px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-block; padding: 12px 32px;">${props.canPayOnline ? 'Pay Now' : 'View Invoice'}</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 16px 0; text-align: center;">
      If you've already made this payment, please disregard this reminder. Thank you for your business!
    </p>
    
    <hr style="border-color: #e5e7eb; margin: 32px 0;">
    
    <p style="color: #6b7280; font-size: 14px; line-height: 22px; text-align: center; margin: 0;">
      Questions? Contact us:
      ${props.businessEmail ? `<br>${props.businessEmail}` : ''}
      ${props.businessPhone ? `<br>${props.businessPhone}` : ''}
    </p>
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">${props.businessName}</p>
  </div>
</body>
</html>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { invoice_id }: SendReminderEmailRequest = await req.json()

    if (!invoice_id) {
      throw new Error('invoice_id is required')
    }

    console.log('Fetching invoice for reminder:', invoice_id)

    // Fetch invoice with customer and business data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*),
        business:businesses(*)
      `)
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError)
      throw new Error('Invoice not found')
    }

    const customer = invoice.customer
    const business = invoice.business

    if (!customer?.email) {
      return new Response(
        JSON.stringify({ success: false, reason: 'No customer email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate days overdue
    let daysOverdue = 0
    if (invoice.due_date) {
      const dueDate = new Date(invoice.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      const diffTime = today.getTime() - dueDate.getTime()
      daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    // Generate public URL
    const publicUrl = `https://wzglfwcftigofbuojeci.lovableproject.com/invoice/${invoice.public_token}`

    // Format currency
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    })

    // Format date
    const formatDate = (dateStr: string) => {
      if (!dateStr) return undefined
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    const canPayOnline = business?.stripe_account_id && business?.stripe_onboarding_complete

    console.log('Generating reminder email HTML')

    const html = generateReminderEmailHtml({
      customerName: customer.first_name || 'Valued Customer',
      invoiceNumber: invoice.invoice_number,
      balanceDue: formatter.format(invoice.balance_due || 0),
      dueDate: formatDate(invoice.due_date),
      daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
      publicUrl,
      businessName: business?.name || 'Our Company',
      businessEmail: business?.email,
      businessPhone: business?.phone,
      canPayOnline: !!canPayOnline,
    })

    console.log('Sending reminder email to:', customer.email)

    // Determine subject based on overdue status
    const subject = daysOverdue > 0
      ? `⚠️ Payment Overdue: Invoice ${invoice.invoice_number} - ${formatter.format(invoice.balance_due || 0)}`
      : `Payment Reminder: Invoice ${invoice.invoice_number} - ${formatter.format(invoice.balance_due || 0)} due`

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: business?.email ? `${business.name} <${business.email}>` : `${business?.name || 'Invoices'} <onboarding@resend.dev>`,
      to: [customer.email],
      subject,
      html,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return new Response(
        JSON.stringify({ success: false, reason: emailError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Reminder email sent successfully:', emailData)

    return new Response(
      JSON.stringify({ success: true, email_sent: true, email_id: emailData?.id, days_overdue: daysOverdue }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-reminder-email:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
