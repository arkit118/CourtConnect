// Supabase Edge Function: send-parent-consent-email
//
// Sends the parent/guardian consent email for a minor who has requested
// partner matching / chat access. Called by the frontend immediately
// after request_parent_consent() (see
// supabase/migrations/20260728000008_015_social_rpcs.sql) has created the
// pending consent request and returned a token.
//
// This function does NOT touch the database at all - it only sends an
// email via Resend. It requires the caller to be a signed-in CourtConnect
// user (verified via the Authorization header against Supabase Auth,
// using the anon key - never service_role) purely to prevent this
// endpoint being used as an open email-spam relay; it does not read or
// write any table.
//
// Required environment variables (set via `supabase secrets set` or the
// Supabase dashboard's Edge Functions > Secrets page):
//   RESEND_API_KEY           - a Resend API key
//   PARENT_CONSENT_FROM_EMAIL - the verified "from" address in Resend
//   APP_BASE_URL              - e.g. https://courtconnect.vercel.app
//   SUPABASE_URL              - already present by default in the
//                               Edge Function runtime
//   SUPABASE_ANON_KEY         - already present by default
//
// If RESEND_API_KEY, PARENT_CONSENT_FROM_EMAIL, or APP_BASE_URL are not
// set, this function returns a clear 503 with a `configured: false` body
// instead of crashing. The frontend treats that as "email not sent yet"
// and leaves the minor's account in parent_consent_status = 'pending' -
// it never enables matching/chat just because the request was recorded.

import { createClient } from 'npm:@supabase/supabase-js@2';

interface RequestBody {
  token: string;
  parentEmail: string;
  childName: string;
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('send-parent-consent-email: missing SUPABASE_URL/SUPABASE_ANON_KEY');
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller is a real signed-in user, using the anon key only
    // (never service_role) - this endpoint never reads/writes the
    // database, it only needs to confirm "a logged-in user asked for
    // this" before spending a Resend send.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body: Partial<RequestBody> = await req.json().catch(() => ({}));
    const { token, parentEmail, childName } = body;

    if (!token || !parentEmail || !childName) {
      return new Response(JSON.stringify({ ok: false, error: 'token, parentEmail, and childName are required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidEmail(parentEmail)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid parent email' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('PARENT_CONSENT_FROM_EMAIL');
    const appBaseUrl = Deno.env.get('APP_BASE_URL');

    if (!resendApiKey || !fromEmail || !appBaseUrl) {
      console.error(
        'send-parent-consent-email: missing one or more of RESEND_API_KEY, PARENT_CONSENT_FROM_EMAIL, APP_BASE_URL'
      );
      return new Response(
        JSON.stringify({
          ok: false,
          configured: false,
          error:
            'Parent consent email is not configured yet. RESEND_API_KEY, PARENT_CONSENT_FROM_EMAIL, and APP_BASE_URL must be set as Edge Function secrets.',
        }),
        { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const consentUrl = `${appBaseUrl.replace(/\/+$/, '')}/parental-consent?token=${encodeURIComponent(token)}`;

    const html = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
        <h1 style="font-size: 20px;">CourtConnect: Parent/Guardian Approval Needed</h1>
        <p>Hello,</p>
        <p>
          <strong>${escapeHtml(childName)}</strong> has an account on CourtConnect, a local tennis community
          platform, and would like to use two optional features: <strong>partner matching</strong> and
          <strong>in-app chat</strong> with other CourtConnect members.
        </p>
        <p>Here is what you should know before deciding:</p>
        <ul>
          <li>Minors are only ever matched with other minors - never with adult members.</li>
          <li>CourtConnect does not officially reserve courts.</li>
          <li>CourtConnect does not process payments of any kind.</li>
          <li>Any in-person meetups should happen at public courts and, ideally, with parent/guardian awareness or supervision.</li>
          <li>Your child can already use CourtConnect's public features (courts, events, schedule) without this approval - this only affects matching and chat.</li>
        </ul>
        <p>
          You can approve or decline this request. You do not need to create a CourtConnect account to do
          either.
        </p>
        <p style="margin: 32px 0;">
          <a href="${consentUrl}" style="background:#0d9488;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Review and Respond
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          Or copy and paste this link into your browser: ${consentUrl}
        </p>
        <p style="font-size: 13px; color: #6b7280; margin-top: 32px;">
          If you did not expect this email, you can safely ignore it - no changes will be made without a decision
          on this link.
        </p>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [parentEmail],
        subject: 'CourtConnect: Parent/Guardian Approval Needed',
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('send-parent-consent-email: Resend error', {
        status: resendResponse.status,
        body: errText,
        token,
        parentEmail,
      });
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to send the consent email. Please try again.' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Record that the email genuinely sent - this is what lets the frontend
    // (useSocialEligibility / SocialOnboardingGate) tell "we're waiting on
    // your parent" apart from "we couldn't confirm the email went out,
    // please retry" on a page reload, instead of always claiming the
    // former regardless of what actually happened. Non-fatal if it fails:
    // Resend already accepted the email, so this function still reports
    // success to the caller, but logs loudly since it means the DB and
    // reality have now diverged and is worth investigating.
    const { error: markError } = await supabase.rpc('mark_parent_consent_email_sent', { p_token: token });
    if (markError) {
      console.error('send-parent-consent-email: email sent but mark_parent_consent_email_sent failed', {
        token,
        markError,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-parent-consent-email: unexpected error', err);
    return new Response(JSON.stringify({ ok: false, error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
