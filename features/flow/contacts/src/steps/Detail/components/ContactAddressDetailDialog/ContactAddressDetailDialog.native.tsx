import React, { useEffect, useState } from "react";
import { BottomSheetHeader, BottomSheetView, Box } from "@ledgerhq/lumen-ui-rnative";
import { ContactAddressDetailActions } from "./ContactAddressDetailActions.native";
import { ContactAddressDetailSummary } from "./ContactAddressDetailSummary.native";
import type { ContactAddressDetailDialogProps } from "./types";

const COPY_FEEDBACK_MS = 3000;

export type ContactAddressDetailDialogNativeProps = ContactAddressDetailDialogProps &
  Readonly<{
    bottomInset?: number;
    onCopyAddress?: (address: string) => void;
  }>;

export function ContactAddressDetailDialog({
  isOpen,
  contactName,
  row,
  network,
  labels,
  bottomInset = 0,
  onCopyAddress,
}: ContactAddressDetailDialogNativeProps): React.JSX.Element | null {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setHasCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!hasCopied) {
      return;
    }

    const timeoutId = setTimeout(() => setHasCopied(false), COPY_FEEDBACK_MS);

    return () => clearTimeout(timeoutId);
  }, [hasCopied]);

  const handleCopy = () => {
    if (row === undefined) {
      return;
    }

    onCopyAddress?.(row.address);
    setHasCopied(true);
  };

  if (!isOpen || row === undefined || network === undefined) {
    return null;
  }

  return (
    <BottomSheetView
      testID="contacts-address-detail-dialog"
      style={{ paddingBottom: bottomInset + 24 }}
    >
      <BottomSheetHeader title={contactName} />
      <Box lx={{ gap: "s40", paddingHorizontal: "s24", paddingTop: "s24" }}>
        <ContactAddressDetailSummary
          row={row}
          network={network}
          formatNetworkTag={labels.formatNetworkTag}
        />
        <ContactAddressDetailActions
          labels={labels}
          hasCopied={hasCopied}
          onCopy={handleCopy}
        />
      </Box>
    </BottomSheetView>
  );
}
