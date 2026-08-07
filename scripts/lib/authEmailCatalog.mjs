import { ctaButton, emailBrand, greetingHtml, p, wrapAuthEmailHtml } from './emailBrand.mjs'

const brand = emailBrand.shortName

/** Catalogo subject + HTML per Auth e notifiche sicurezza. */
export function buildAuthEmailCatalog() {
  return {
    confirmation: {
      subject: `Conferma il tuo account ${brand}`,
      file: 'confirmation.html',
      html: wrapAuthEmailHtml({
        title: 'Conferma la tua email',
        bodyHtml: [
          greetingHtml(),
          p(
            `Grazie per esserti registrato su <strong>${brand}</strong>. Clicca il pulsante qui sotto per confermare l'indirizzo email e completare la registrazione.`,
          ),
          ctaButton('Conferma email', '{{ .ConfirmationURL }}'),
          p(
            'Dopo la conferma, l\'accesso potrebbe richiedere l\'approvazione di un amministratore.',
          ),
        ].join('\n'),
      }),
    },
    recovery: {
      subject: `Reimposta la password ${brand}`,
      file: 'recovery.html',
      html: wrapAuthEmailHtml({
        title: 'Reimposta la password',
        bodyHtml: [
          greetingHtml(),
          p(
            `Abbiamo ricevuto una richiesta di reset password per l'account <strong>{{ .Email }}</strong> su ${brand}.`,
          ),
          ctaButton('Reimposta password', '{{ .ConfirmationURL }}'),
        ].join('\n'),
        footerNote:
          'Se non hai richiesto il reset, ignora questa email: la password resterà invariata.',
      }),
    },
    invite: {
      subject: `Sei stato invitato su ${brand}`,
      file: 'invite.html',
      html: wrapAuthEmailHtml({
        title: 'Invito al gestionale',
        bodyHtml: [
          greetingHtml(),
          p(
            `Sei stato invitato a creare un account su <strong>${emailBrand.name}</strong>. Clicca il pulsante per accettare l'invito e impostare la password.`,
          ),
          ctaButton('Accetta invito', '{{ .ConfirmationURL }}'),
        ].join('\n'),
      }),
    },
    magic_link: {
      subject: `Il tuo link di accesso ${brand}`,
      file: 'magic_link.html',
      html: wrapAuthEmailHtml({
        title: 'Link di accesso',
        bodyHtml: [
          greetingHtml(),
          p(
            `Usa il pulsante qui sotto per accedere a <strong>${brand}</strong>. Il link scade a breve e può essere usato una sola volta.`,
          ),
          ctaButton('Accedi', '{{ .ConfirmationURL }}'),
        ].join('\n'),
      }),
    },
    email_change: {
      subject: `Conferma il nuovo indirizzo email su ${brand}`,
      file: 'email_change.html',
      html: wrapAuthEmailHtml({
        title: 'Conferma nuovo indirizzo email',
        bodyHtml: [
          greetingHtml(),
          p(
            `Hai richiesto di aggiornare l'email del tuo account ${brand} a <strong>{{ .NewEmail }}</strong>.`,
          ),
          ctaButton('Conferma nuova email', '{{ .ConfirmationURL }}'),
        ].join('\n'),
        footerNote:
          'Se non hai richiesto questa modifica, ignora questa email.',
      }),
    },
    reauthentication: {
      subject: `Il tuo codice di verifica ${brand}: {{ .Token }}`,
      file: 'reauthentication.html',
      html: wrapAuthEmailHtml({
        title: 'Codice di verifica',
        bodyHtml: [
          greetingHtml(),
          p(
            `Usa questo codice per verificare la tua identità su <strong>${brand}</strong>. Scade a breve.`,
          ),
          `<p style="margin:0 0 28px;text-align:center;font-size:32px;letter-spacing:6px;font-weight:700;color:${emailBrand.colors.accent};">{{ .Token }}</p>`,
        ].join('\n'),
      }),
    },
    password_changed_notification: {
      subject: `La password del tuo account ${brand} è stata modificata`,
      file: 'password_changed_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Password modificata',
        bodyHtml: [
          greetingHtml(),
          p(
            `La password del tuo account <strong>{{ .Email }}</strong> su ${brand} è stata modificata di recente.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, reimposta subito la password e contatta il supporto.',
      }),
    },
    email_changed_notification: {
      subject: `L'indirizzo email del tuo account ${brand} è stato modificato`,
      file: 'email_changed_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Email modificata',
        bodyHtml: [
          greetingHtml(),
          p(
            `L'indirizzo email del tuo account ${brand} è passato da <strong>{{ .OldEmail }}</strong> a <strong>{{ .Email }}</strong>.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, contatta subito il supporto.',
      }),
    },
    phone_changed_notification: {
      subject: `Il numero di telefono del tuo account ${brand} è stato modificato`,
      file: 'phone_changed_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Telefono modificato',
        bodyHtml: [
          greetingHtml(),
          p(
            `Il numero di telefono del tuo account ${brand} è passato da <strong>{{ .OldPhone }}</strong> a <strong>{{ .Phone }}</strong>.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, contatta subito il supporto.',
      }),
    },
    identity_linked_notification: {
      subject: `Nuovo metodo di accesso su ${brand}`,
      file: 'identity_linked_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Metodo di accesso collegato',
        bodyHtml: [
          greetingHtml(),
          p(
            `Il tuo account <strong>{{ .Provider }}</strong> è stato collegato come metodo di accesso per <strong>{{ .Email }}</strong> su ${brand}.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, contatta subito il supporto.',
      }),
    },
    identity_unlinked_notification: {
      subject: `Metodo di accesso rimosso da ${brand}`,
      file: 'identity_unlinked_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Metodo di accesso rimosso',
        bodyHtml: [
          greetingHtml(),
          p(
            `Il metodo di accesso <strong>{{ .Provider }}</strong> è stato rimosso dall'account <strong>{{ .Email }}</strong> su ${brand}.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, contatta subito il supporto.',
      }),
    },
    mfa_factor_enrolled_notification: {
      subject: `Verifica aggiuntiva attivata su ${brand}`,
      file: 'mfa_factor_enrolled_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Verifica aggiuntiva attivata',
        bodyHtml: [
          greetingHtml(),
          p(
            `È stato aggiunto il metodo di verifica <strong>{{ .FactorType }}</strong> al tuo account ${brand}.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, contatta subito il supporto.',
      }),
    },
    mfa_factor_unenrolled_notification: {
      subject: `Verifica rimossa dal tuo account ${brand}`,
      file: 'mfa_factor_unenrolled_notification.html',
      html: wrapAuthEmailHtml({
        title: 'Verifica rimossa',
        bodyHtml: [
          greetingHtml(),
          p(
            `Il metodo di verifica <strong>{{ .FactorType }}</strong> è stato rimosso dal tuo account ${brand}.`,
          ),
        ].join('\n'),
        footerNote:
          'Se non hai effettuato tu questa modifica, contatta subito il supporto.',
      }),
    },
  }
}

export const notificationEnableKeys = [
  'password_changed',
  'email_changed',
  'phone_changed',
  'identity_linked',
  'identity_unlinked',
  'mfa_factor_enrolled',
  'mfa_factor_unenrolled',
]
