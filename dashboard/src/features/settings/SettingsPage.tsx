import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Calculator,
  Menu,
  Receipt,
  Settings,
  SlidersHorizontal,
  Store,
  Users,
  Wallet as WalletIcon,
  type LucideIcon,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { useCollection } from '@/hooks/useCollection';
import { roleAllows } from '@/config/plans';
import { useT } from '@/i18n';
import { toast } from '@/stores/toast';
import { demoGuard } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import {
  isSupabaseConfigured,
} from '@/data/supabase-client';
import { BusinessSettings } from './BusinessSettings';
import { OperationsSettings } from './OperationsSettings';
import { TeamSettings } from './TeamSettings';
import { WalletSettings } from './WalletSettings';
import { OutletSettings } from './OutletSettings';
import { NavigationSettings } from './NavigationSettings';
import { SystemSettings } from './SystemSettings';
import { SettingsTabs } from './SettingsTabs';
import { QuoteRatesTab } from './QuoteRatesTab';
import { ReceiptTab } from './ReceiptTab';

type Tab =
  | 'usaha'
  | 'operasional'
  | 'nota'
  | 'tarif'
  | 'tim'
  | 'keuangan'
  | 'outlet'
  | 'navigasi'
  | 'sistem';

const TAB_IDS: Tab[] = [
  'usaha',
  'operasional',
  'nota',
  'tarif',
  'tim',
  'keuangan',
  'outlet',
  'navigasi',
  'sistem',
];

export function SettingsPage() {
  const me = useSessionStore((s) => s.currentEmployee);
  const resetWorkspace = useSessionStore((s) => s.resetWorkspace);
  const isOwner = me ? roleAllows(me.role, '*') : false;
  const t = useT();

  const { data: wallets } = useCollection('wallets');
  const { data: outlets } = useCollection('outlets');
  const { data: employees } = useCollection('employees');

  // ?tab= membuat kartu terkunci (dan kanal terkunci di sidebar) bisa
  // menautkan langsung ke tab yang relevan. Nilai tak dikenal jatuh ke
  // Usaha; tab yang tidak boleh dilihat peran ini disaring oleh visibleTabs.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requestedTab && TAB_IDS.includes(requestedTab) ? requestedTab : 'usaha',
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const TABS: {
    id: Tab;
    label: string;
    icon: LucideIcon;
    ownerOnly?: boolean;
    cloudOnly?: boolean;
  }[] = [
    { id: 'usaha', label: t('settingsPage.tabBusiness'), icon: Store },
    { id: 'operasional', label: t('settingsPage.tabOps'), icon: SlidersHorizontal },
    { id: 'nota', label: t('receipt.tab'), icon: Receipt },
    { id: 'tarif', label: t('quoteRates.tab'), icon: Calculator, ownerOnly: true },
    { id: 'tim', label: t('settingsPage.tabTeam'), icon: Users, ownerOnly: true },
    { id: 'keuangan', label: t('settingsPage.tabWallet'), icon: WalletIcon, ownerOnly: true },
    { id: 'outlet', label: t('settingsPage.tabOutlet'), icon: Building2, ownerOnly: true },
    {
      id: 'navigasi',
      label: t('settings.mobileNav.tab'),
      icon: Menu,
      ownerOnly: true,
    },
    { id: 'sistem', label: t('settingsPage.tabSystem'), icon: Settings },
  ];
  const visibleTabs = TABS.filter(
    (item) => (!item.ownerOnly || isOwner) && (!item.cloudOnly || isSupabaseConfigured),
  );

  return (
    <div data-nu className="@container/settings flex flex-col gap-4 bg-transparent">
      <SettingsTabs tabs={visibleTabs} value={tab} onChange={setTab} label={t('settingsPage.sectionsAria')} />

      {tab === 'usaha' && <BusinessSettings isOwner={isOwner} />}
      {tab === 'operasional' && <OperationsSettings />}
      {tab === 'nota' && <ReceiptTab />}
      {tab === 'tarif' && isOwner && <QuoteRatesTab />}
      {tab === 'tim' && isOwner && <TeamSettings employees={employees} outlets={outlets} />}
      {tab === 'keuangan' && isOwner && <WalletSettings wallets={wallets} outlets={outlets} />}
      {tab === 'outlet' && isOwner && <OutletSettings outlets={outlets} />}
      {tab === 'navigasi' && isOwner && <NavigationSettings />}
      {tab === 'sistem' && (
        <SystemSettings
          onReset={() => {
            if (demoGuard('settingsPage.resetDemo')) return;
            setConfirmReset(true);
          }}
          isOwner={isOwner}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        title={t('settingsPage.resetSeluruhData')}
        message={
          isSupabaseConfigured
            ? t('settingsPage.resetCloudMsg')
            : t('settingsPage.resetLocalMsg')
        }
        confirmLabel={t('settingsPage.yaResetSemua')}
        danger
        onConfirm={async () => {
          try {
            await resetWorkspace();
            toast.success(t('settingsPage.workspaceDireset'));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('settingsPage.resetFailed'));
          } finally {
            // In cloud the workspace stays mounted (empty), so the dialog must
            // be closed explicitly — it isn't unmounted like the local wizard path.
            setConfirmReset(false);
          }
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
