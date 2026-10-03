/** Writing video packages: create (with CTA rotation and idea link), status, CTA, AI blocks. */
import { nextCta } from '@/core/cta';
import { withStatus } from '@/core/videos';
import type { CtaType, VideoBlockKey, VideoKind, VideoStatus } from '@/data/domain';
import { brandRepo, ideasRepo, videosRepo } from '@/data/repositories';
import type { Video } from '@/data/schemas';
import { VIDEO_BLOCK_TEMPLATES } from '@/data/templates';
import { generate } from '@/services/ai/client';

export async function createVideo(input: {
  topic: string;
  date: string;
  kind: VideoKind;
  ideaId?: string;
}): Promise<Video> {
  const idea = input.ideaId ? ideasRepo.get(input.ideaId) : undefined;
  const cta = nextCta(brandRepo.get().lastCta);
  const now = new Date().toISOString();
  const video = await videosRepo.create({
    topic: input.topic,
    date: input.date,
    kind: input.kind,
    cta,
    ideaId: idea?.id,
    series: idea?.series,
    hookType: idea?.hookType,
    status: 'idea',
    statusHistory: [{ status: 'idea', at: now }],
  });
  // The rotation moves on with every new package ("Stand gespeichert").
  await brandRepo.update({ lastCta: cta });
  if (idea) {
    await ideasRepo.update(idea.id, {
      videoId: video.id,
      status: idea.status === 'idea' ? 'planned' : idea.status,
    });
  }
  return video;
}

export async function setVideoStatus(video: Video, status: VideoStatus): Promise<Video> {
  const updated = await videosRepo.update(
    video.id,
    withStatus(video, status, new Date().toISOString()),
  );
  // The linked idea follows the big steps of its video.
  const idea = video.ideaId ? ideasRepo.get(video.ideaId) : undefined;
  if (idea) {
    const ideaStatus =
      status === 'published'
        ? 'published'
        : status === 'filmed' || status === 'edited'
          ? 'filmed'
          : undefined;
    if (ideaStatus && idea.status !== ideaStatus)
      await ideasRepo.update(idea.id, { status: ideaStatus });
  }
  return updated;
}

/** A changed CTA becomes the new state of the rotation. */
export async function setVideoCta(video: Video, cta: CtaType): Promise<void> {
  await videosRepo.update(video.id, { cta });
  await brandRepo.update({ lastCta: cta });
}

export async function setBlock(
  video: Video,
  key: VideoBlockKey,
  text: string,
  fromAi = false,
): Promise<Video> {
  const current = videosRepo.get(video.id) ?? video;
  const aiBlocks = current.aiBlocks.filter((block) => block !== key);
  return videosRepo.update(video.id, {
    blocks: { ...current.blocks, [key]: text },
    aiBlocks: fromAi && text.trim() ? [...aiBlocks, key] : aiBlocks,
  });
}

/** Claude writes one block; other blocks get the script as context. */
export async function generateBlock(
  video: Video,
  key: VideoBlockKey,
  model: string,
): Promise<string> {
  const current = videosRepo.get(video.id) ?? video;
  const context = { topic: current.topic, kind: current.kind, cta: current.cta ?? 'share' };
  const task = VIDEO_BLOCK_TEMPLATES[key].prompt(context);
  const script = current.blocks.script;
  const prompt =
    key !== 'script' && script ? `${task}\n\nSkript des Videos:\n"""\n${script}\n"""` : task;
  const text = await generate({ model, prompt });
  await setBlock(current, key, text, true);
  return text;
}
