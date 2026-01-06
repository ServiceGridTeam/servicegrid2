import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@4.0.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { notifyBusinessTeam } from "../_shared/notifications.ts"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendInvoiceEmailRequest {
  invoice_id: string
}

// Simple HTML template function
function generateInvoiceEmailHtml(props: {
  customerName: string
  invoiceNumber: string
  total: string
  balanceDue: string
  dueDate?: string
  publicUrl: string
  businessName: string
  businessEmail?: string
  businessPhone?: string
  canPayOnline: boolean
}): string {
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
    
    <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 16px 0;">Hi ${props.customerName},</p>
    
    <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 16px 0;">
      Please find your invoice below. ${props.canPayOnline ? 'You can pay securely online using the button below.' : 'Please review the details at your convenience.'}
    </p>
    
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Invoice Number</p>
      <p style="color: #1a1a1a; font-size: 16px; font-weight: 500; margin: 0;">${props.invoiceNumber}</p>
      
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Invoice Total</p>
      <p style="color: #1a1a1a; font-size: 16px; font-weight: 500; margin: 0;">${props.total}</p>
      
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Balance Due</p>
      <p style="color: #1a1a1a; font-size: 28px; font-weight: 700; margin: 0;">${props.balanceDue}</p>
      
      ${props.dueDate ? `
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Due Date</p>
      <p style="color: #1a1a1a; font-size: 16px; font-weight: 500; margin: 0;">${props.dueDate}</p>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${props.publicUrl}" style="background-color: #059669; border-radius: 6px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-block; padding: 12px 32px;">${props.canPayOnline ? 'View & Pay Invoice' : 'View Invoice'}</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 16px 0; text-align: center;">
      Click the button above to view the full invoice details${props.canPayOnline ? ' and make a secure payment' : ''}.
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

    const { invoice_id }: SendInvoiceEmailRequest = await req.json()

    if (!invoice_id) {
      throw new Error('invoice_id is required')
    }

    console.log('Fetching invoice:', invoice_id)

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
      console.log('No customer email, skipping email send')
      // Still update the invoice as sent
      await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoice_id)

      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: 'No customer email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    console.log('Generating email HTML')

    const html = generateInvoiceEmailHtml({
      customerName: customer.first_name || 'Valued Customer',
      invoiceNumber: invoice.invoice_number,
      total: formatter.format(invoice.total || 0),
      balanceDue: formatter.format(invoice.balance_due || 0),
      dueDate: formatDate(invoice.due_date),
      publicUrl,
      businessName: business?.name || 'Our Company',
      businessEmail: business?.email,
      businessPhone: business?.phone,
      canPayOnline: !!canPayOnline,
    })

    console.log('Sending email to:', customer.email)

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: business?.email ? `${business.name} <${business.email}>` : `${business?.name || 'Invoices'} <onboarding@resend.dev>`,
      to: [customer.email],
      subject: `Invoice ${invoice.invoice_number} from ${business?.name || 'Us'} - ${formatter.format(invoice.balance_due || 0)} due`,
      html,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      // Still update invoice status even if email fails
      await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoice_id)

      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: emailError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email sent successfully:', emailData)

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invoice_id)

    // Create in-app notification for team
    await notifyBusinessTeam(supabase, invoice.business_id, {
      type: "invoice",
      title: "Invoice Sent",
      message: `Invoice ${invoice.invoice_number} sent to ${customer.first_name} ${customer.last_name}`,
      data: { invoiceId: invoice_id, customerId: customer.id },
    })

    return new Response(
      JSON.stringify({ success: true, email_sent: true, email_id: emailData?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-invoice-email:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
