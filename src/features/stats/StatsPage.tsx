import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Camera, FileUp, MonitorPlay, Plus, ScanText, Users } from 'lucide-react';
import { ActionMenuButton, Button, EmptyState, SegmentedControl } from '@/components/ui';
import { Page } from '@/app/shell/Page';
import type { Post } from '@/data/schemas';
import { de } from '@/i18n/de';
import { useSettings } from '@/features/settings/settingsStore';
import { AccountStatDialog } from './AccountStatDialog';
import { ImportDialog } from './ImportDialog';
import { InsightsTab } from './InsightsTab';
import { PostEditor, type PostPrefill } from './PostEditor';
import { PostsTab } from './PostsTab';
import { ReportTab } from './ReportTab';
import { ScreenshotDialog } from './ScreenshotDialog';
import { InstagramImportDialog } from './InstagramImportDialog';
import { YouTubeImportDialog } from './YouTubeImportDialog';
import { usePosts } from './statsData';

const t = de.stats;
const TABS = ['posts', 'report', 'insights'] as const;
type Tab = (typeof TABS)[number];

type Dialog =
  | { kind: 'post'; post?: Post; prefill?: PostPrefill }
  | { kind: 'import' }
  | { kind: 'screenshot' }
  | { kind: 'youtube' }
  | { kind: 'instagram' }
  | { kind: 'account' }
  | null;

/** Numbers & evaluation: posts, weekly report, what works. */
export function StatsPage() {
  const posts = usePosts();
  const aiEnabled = useSettings((s) => s.aiEnabled);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'posts';
  const [dialog, setDialog] = useState<Dialog>(() => (params.get('new') ? { kind: 'post' } : null));

  const close = () => {
    setDialog(null);
    if (params.get('new')) setParams(tab === 'posts' ? {} : { tab }, { replace: true });
  };

  const menu = [
    {
      id: 'import',
      label: t.importCsv,
      icon: FileUp,
      onSelect: () => setDialog({ kind: 'import' }),
    },
    ...(aiEnabled
      ? [
          {
            id: 'screenshot',
            label: t.readScreenshot,
            icon: ScanText,
            onSelect: () => setDialog({ kind: 'screenshot' }),
          },
        ]
      : []),
    {
      id: 'instagram',
      label: de.instagram.import.menu,
      icon: Camera,
      onSelect: () => setDialog({ kind: 'instagram' }),
    },
    {
      id: 'youtube',
      label: de.youtube.import.menu,
      icon: MonitorPlay,
      onSelect: () => setDialog({ kind: 'youtube' }),
    },
    {
      id: 'account',
      label: t.addFollowers,
      icon: Users,
      onSelect: () => setDialog({ kind: 'account' }),
    },
  ];

  return (
    <Page
      title={t.title}
      actions={
        <>
          <ActionMenuButton items={menu} label={t.menu} testId="stats-menu" />
          <Button
            size="sm"
            icon={Plus}
            onClick={() => setDialog({ kind: 'post' })}
            data-testid="post-add"
          >
            <span className="max-[30rem]:sr-only">{t.add}</span>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-8">
        <SegmentedControl
          label={t.tabsLabel}
          options={TABS.map((value) => ({ value, label: t.tabs[value] }))}
          value={tab}
          onChange={(value) =>
            setParams(value === 'posts' ? {} : { tab: value }, { replace: true })
          }
        />
        {tab === 'posts' &&
          (posts.length === 0 ? (
            <>
              <EmptyState
                title={t.emptyTitle}
                text={t.emptyText}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button icon={Plus} onClick={() => setDialog({ kind: 'post' })}>
                      {t.addLong}
                    </Button>
                    <Button
                      variant="secondary"
                      icon={FileUp}
                      onClick={() => setDialog({ kind: 'import' })}
                    >
                      {t.importCsv}
                    </Button>
                  </div>
                }
              />
              <PostsTab
                posts={posts}
                onOpen={() => undefined}
                onAddFollowers={() => setDialog({ kind: 'account' })}
              />
            </>
          ) : (
            <PostsTab
              posts={posts}
              onOpen={(post) => setDialog({ kind: 'post', post })}
              onAddFollowers={() => setDialog({ kind: 'account' })}
            />
          ))}
        {tab === 'report' && <ReportTab posts={posts} />}
        {tab === 'insights' && <InsightsTab posts={posts} />}
      </div>
      <PostEditor
        open={dialog?.kind === 'post'}
        post={dialog?.kind === 'post' ? dialog.post : undefined}
        prefill={dialog?.kind === 'post' ? dialog.prefill : undefined}
        onClose={close}
      />
      <ImportDialog open={dialog?.kind === 'import'} onClose={close} />
      <AccountStatDialog open={dialog?.kind === 'account'} onClose={close} />
      <ScreenshotDialog
        open={dialog?.kind === 'screenshot'}
        onClose={close}
        onRead={(prefill) => setDialog({ kind: 'post', prefill })}
      />
      <YouTubeImportDialog open={dialog?.kind === 'youtube'} onClose={close} />
      <InstagramImportDialog open={dialog?.kind === 'instagram'} onClose={close} />
    </Page>
  );
}
