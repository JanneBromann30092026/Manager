/**
 * Sends the due push reminders (GitHub Actions, .github/workflows/push.yml).
 * Reads the secret MANAGER_PUSH (copied from the app: Einstellungen → Mitteilungen) and sends
 * the general texts whose weekday and hour match now (Europe/Berlin). PUSH_MODE=test sends the
 * test message. Never logs the secret, the keys or the subscription endpoint.
 */
import webPush from 'web-push';
import {
  dueKinds,
  pushConfigSchema,
  zonedParts,
  type PushConfig,
  type PushMessageKind,
} from '../src/core/push.ts';

function readConfig(): PushConfig | null {
  const raw = process.env.MANAGER_PUSH?.trim();
  if (!raw) return null;
  try {
    return pushConfigSchema.parse(JSON.parse(raw));
  } catch {
    console.error('MANAGER_PUSH ist ungültig – in der App unter Mitteilungen neu kopieren.');
    process.exit(1);
  }
}

async function send(config: PushConfig, kind: PushMessageKind): Promise<void> {
  const message = config.messages[kind];
  try {
    await webPush.sendNotification(
      config.subscription,
      JSON.stringify({ ...message, tag: `manager-${kind}` }),
      {
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
        TTL: 4 * 60 * 60,
        urgency: 'normal',
        topic: kind,
      },
    );
    console.log(`Gesendet: ${kind}`);
  } catch (error: unknown) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      console.error('Das Push-Abo gilt nicht mehr – in der App Mitteilungen neu einrichten.');
    } else {
      console.error(`Senden fehlgeschlagen (${kind}, Status ${status ?? 'unbekannt'}).`);
    }
    process.exitCode = 1;
  }
}

const config = readConfig();
if (!config) {
  console.log('Keine Mitteilungen eingerichtet (Secret MANAGER_PUSH fehlt).');
} else {
  const now = new Date();
  const kinds: PushMessageKind[] =
    process.env.PUSH_MODE === 'test'
      ? ['test']
      : dueKinds(config.schedule, zonedParts(now, config.timeZone));
  if (kinds.length === 0) console.log('Jetzt ist nichts fällig.');
  for (const kind of kinds) await send(config, kind);
}
