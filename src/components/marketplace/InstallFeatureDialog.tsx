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
  onOpenChange: (open: boolean) => void;
}

export function InstallFeatureDialog({ feature, onOpenChange }: InstallFeatureDialogProps) {
  return (
    <AlertDialog open={Boolean(feature)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Install {feature?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This feature will be added to your system. Installation usually takes a few minutes to
            complete. Installation requests are not being submitted from this page yet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>I understand</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
