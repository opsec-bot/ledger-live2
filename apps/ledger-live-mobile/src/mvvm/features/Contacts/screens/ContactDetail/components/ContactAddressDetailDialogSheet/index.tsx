import React, { useCallback } from "react";
import Clipboard from "@react-native-clipboard/clipboard";
import {
  ContactAddressDetailDialog,
  type ContactAddressDetailDialogProps,
} from "@features/flow-contacts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QueuedDrawerBottomSheet from "LLM/components/QueuedDrawer/QueuedDrawerBottomSheet";

export function ContactAddressDetailDialogSheet({
  isOpen,
  onClose,
  ...dialogProps
}: ContactAddressDetailDialogProps): React.JSX.Element {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const onCopyAddress = useCallback((address: string) => {
    Clipboard.setString(address);
  }, []);

  return (
    <QueuedDrawerBottomSheet
      isRequestingToBeOpened={isOpen}
      onClose={onClose}
      testID="contacts-address-detail-sheet"
      enableDynamicSizing
    >
      <ContactAddressDetailDialog
        isOpen={isOpen}
        onClose={onClose}
        bottomInset={bottomInset}
        onCopyAddress={onCopyAddress}
        {...dialogProps}
      />
    </QueuedDrawerBottomSheet>
  );
}
