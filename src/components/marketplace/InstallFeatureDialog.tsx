import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MarketplaceFeature } from "@/lib/marketplace-data";

interface InstallFeatureDialogProps {
  feature: MarketplaceFeature | null;
  error: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function InstallFeatureDialog({
  feature,
  error,
  isPending,
  onConfirm,
  onOpenChange,
}: InstallFeatureDialogProps) {
  return (
    <AlertDialog open={Boolean(feature)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Install {feature?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This feature will be added to your system. Installation usually takes a few minutes to
            complete.
          </AlertDialogDescription>
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending
              ? "Requesting…"
              : feature?.installationStatus === "failed"
                ? "Retry"
                : "Install"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
