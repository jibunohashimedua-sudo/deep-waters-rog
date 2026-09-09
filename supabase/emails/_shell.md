# Deep Waters — Supabase auth email templates

These are not sent by this repo. There is no email code here: Supabase
sends the auth emails and Resend is only the SMTP relay, so the templates
live in the Supabase dashboard under Authentication → Emails.

To use one: open the template, switch to the HTML source, and paste the
matching file in this folder over what is there. Nothing changes for
anybody until that paste happens.

Why they are built the way they are:

- **Tables and inline styles.** Gmail strips `<style>` blocks, Outlook
  renders through Word. A stylesheet is not a thing you can rely on, so
  every rule is on the element.
- **Literata will not load.** Almost no client will fetch a web font, so
  scripture falls back to Georgia and then to the platform serif. The
  distinction between scripture and interface survives that; the exact
  face does not, and pretending otherwise would be the mistake.
- **Light ground only.** Dark-mode email is inconsistent to the point of
  being unusable — some clients invert, some don't, some invert only
  parts. So these are the app's light tokens and nothing else.
- Square buttons, 1px hairlines, no radius, no shadow, mono footer. The
  same rules as the app, since this is the app's voice arriving in
  somebody's inbox.
