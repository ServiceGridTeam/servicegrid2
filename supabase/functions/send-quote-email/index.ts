import React from "https://esm.sh/react@18.3.1"
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@4.0.0"
import { render } from "https://esm.sh/@react-email/render@0.0.12"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { notifyBusinessTeam } from "../_shared/notifications.ts"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendQuoteEmailRequest {
  quote_id: string
}

// Simple HTML template function
function generateQuoteEmailHtml(props: {
  customerName: string
  quoteNumber: string
  quoteTitle?: string
  total: string
  validUntil?: string
  publicUrl: string
  businessName: string
  businessEmail?: string
  businessPhone?: string
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
      ${props.quoteTitle ? `We've prepared a quote for "${props.quoteTitle}" for your review.` : "We've prepared a quote for your review."}
    </p>
    
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Quote Number</p>
      <p style="color: #1a1a1a; font-size: 16px; font-weight: 500; margin: 0;">${props.quoteNumber}</p>
      
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Total Amount</p>
      <p style="color: #1a1a1a; font-size: 28px; font-weight: 700; margin: 0;">${props.total}</p>
      
      ${props.validUntil ? `
      <hr style="border-color: #e5e7eb; margin: 16px 0;">
      <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Valid Until</p>
      <p style="color: #1a1a1a; font-size: 16px; font-weight: 500; margin: 0;">${props.validUntil}</p>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${props.publicUrl}" style="background-color: #2563eb; border-radius: 6px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-block; padding: 12px 32px;">View Quote</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 16px 0; text-align: center;">
      Click the button above to view the full quote details and approve it online.
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

    const { quote_id }: SendQuoteEmailRequest = await req.json()

    if (!quote_id) {
      throw new Error('quote_id is required')
    }

    console.log('Fetching quote:', quote_id)

    // Fetch quote with customer and business data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers(*),
        business:businesses(*)
      `)
      .eq('id', quote_id)
      .single()

    if (quoteError || !quote) {
      console.error('Quote fetch error:', quoteError)
      throw new Error('Quote not found')
    }

    const customer = quote.customer
    const business = quote.business

    if (!customer?.email) {
      console.log('No customer email, skipping email send')
      // Still update the quote as sent
      await supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', quote_id)

      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: 'No customer email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate public URL
    const publicUrl = `https://wzglfwcftigofbuojeci.lovableproject.com/quote/${quote.public_token}`

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

    console.log('Generating email HTML')

    const html = generateQuoteEmailHtml({
      customerName: customer.first_name || 'Valued Customer',
      quoteNumber: quote.quote_number,
      quoteTitle: quote.title,
      total: formatter.format(quote.total || 0),
      validUntil: formatDate(quote.valid_until),
      publicUrl,
      businessName: business?.name || 'Our Company',
      businessEmail: business?.email,
      businessPhone: business?.phone,
    })

    console.log('Sending email to:', customer.email)

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: business?.email ? `${business.name} <${business.email}>` : `${business?.name || 'Quotes'} <onboarding@resend.dev>`,
      to: [customer.email],
      subject: `Quote ${quote.quote_number} from ${business?.name || 'Us'}`,
      html,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      // Still update quote status even if email fails
      await supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', quote_id)

      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: emailError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email sent successfully:', emailData)

    // Update quote status
    await supabase
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', quote_id)

    // Create in-app notification for team
    await notifyBusinessTeam(supabase, quote.business_id, {
      type: "quote",
      title: "Quote Sent",
      message: `Quote ${quote.quote_number} sent to ${customer.first_name} ${customer.last_name}`,
      data: { quoteId: quote_id, customerId: customer.id },
    })

    return new Response(
      JSON.stringify({ success: true, email_sent: true, email_id: emailData?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-quote-email:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
