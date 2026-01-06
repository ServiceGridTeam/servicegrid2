import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPaymentFailedEmailRequest {
  invoice_id: string;
  failure_reason?: string;
}

const generatePaymentFailedEmailHtml = (props: {
  customerName: string;
  invoiceNumber: string;
  amount: string;
  failureReason: string;
  paymentUrl: string;
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
}) => {
  const { customerName, invoiceNumber, amount, failureReason, paymentUrl, businessName, businessEmail, businessPhone } = props;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <div style="width: 60px; height: 60px; background-color: #fef2f2; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">⚠️</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #dc2626;">Payment Failed</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hi ${customerName},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                We were unable to process your payment for invoice <strong>${invoiceNumber}</strong>.
              </p>
              
              <!-- Invoice Details Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafafa; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Invoice Number</td>
                        <td style="padding: 8px 0; text-align: right; color: #18181b; font-weight: 500;">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Amount Due</td>
                        <td style="padding: 8px 0; text-align: right; color: #18181b; font-weight: 600; font-size: 18px;">${amount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Reason</td>
                        <td style="padding: 8px 0; text-align: right; color: #dc2626; font-weight: 500;">${failureReason}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Please update your payment method and try again. Common reasons for payment failure include:
              </p>
              
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #52525b; font-size: 14px; line-height: 1.8;">
                <li>Insufficient funds in your account</li>
                <li>Expired or invalid card details</li>
                <li>Card declined by your bank</li>
                <li>Incorrect billing information</li>
              </ul>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${paymentUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      Retry Payment
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #71717a; text-align: center;">
                If you continue to experience issues, please contact us for assistance.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                <strong style="color: #3f3f46;">${businessName}</strong><br>
                ${businessEmail ? `${businessEmail}<br>` : ''}
                ${businessPhone ? `${businessPhone}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoice_id, failure_reason }: SendPaymentFailedEmailRequest = await req.json();

    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }

    console.log("Sending payment failed email for invoice:", invoice_id);

    // Fetch invoice with customer and business details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        customer:customers(*),
        business:businesses(*)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
    }

    const customer = invoice.customer;
    const business = invoice.business;

    if (!customer?.email) {
      console.log("Customer has no email address, skipping notification");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    };

    // Generate public URL for invoice
    const publicUrl = `${req.headers.get("origin") || supabaseUrl.replace(".supabase.co", ".lovable.app")}/invoice/${invoice.public_token}`;

    const emailHtml = generatePaymentFailedEmailHtml({
      customerName: `${customer.first_name} ${customer.last_name}`.trim(),
      invoiceNumber: invoice.invoice_number,
      amount: formatCurrency(invoice.balance_due || invoice.total),
      failureReason: failure_reason || "Payment could not be processed",
      paymentUrl: publicUrl,
      businessName: business.name,
      businessEmail: business.email,
      businessPhone: business.phone,
    });

    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from: `${business.name} <onboarding@resend.dev>`,
      to: [customer.email],
      subject: `Payment Failed - Invoice ${invoice.invoice_number}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Failed to send email:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log("Payment failed email sent successfully to:", customer.email);

    // Create in-app notification for team
    await notifyBusinessTeam(supabase, business.id, {
      type: "payment",
      title: "Payment Failed",
      message: `Payment failed for invoice ${invoice.invoice_number}: ${failure_reason || "Unknown reason"}`,
      data: { invoiceId: invoice_id, customerId: customer.id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-payment-failed-email:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
