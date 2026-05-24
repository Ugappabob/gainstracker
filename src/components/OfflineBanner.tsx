import { useOnline } from '@/hooks/useOnline';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="offline-banner" role="status">
      You&apos;re offline. Changes save on this device and sync when you&apos;re back online.
    </div>
  );
}
