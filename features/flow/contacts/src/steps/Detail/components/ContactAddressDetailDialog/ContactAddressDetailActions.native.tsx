import React from "react";
import { Box, Button } from "@ledgerhq/lumen-ui-rnative";
import { ArrowUp, Check, Copy, PenEdit, Trash } from "@ledgerhq/lumen-ui-rnative/symbols";
import type { ContactAddressDetailDialogLabels } from "./types";

type ContactAddressDetailActionsProps = Readonly<{
  labels: ContactAddressDetailDialogLabels;
  hasCopied: boolean;
  onCopy: () => void;
}>;

export function ContactAddressDetailActions({
  labels,
  hasCopied,
  onCopy,
}: ContactAddressDetailActionsProps): React.JSX.Element {
  return (
    <Box lx={{ flexDirection: "row", gap: "s8", width: "full" }}>
      <Button appearance="gray" size="sm" icon={ArrowUp} disabled lx={{ flex: 1 }}>
        {labels.send}
      </Button>
      <Button
        appearance="gray"
        size="sm"
        icon={hasCopied ? Check : Copy}
        onPress={onCopy}
        testID="contacts-address-detail-copy"
        lx={{ flex: 1 }}
      >
        {hasCopied ? labels.copied : labels.copy}
      </Button>
      <Button appearance="gray" size="sm" icon={PenEdit} disabled lx={{ flex: 1 }}>
        {labels.edit}
      </Button>
      <Button
        appearance="red"
        size="sm"
        icon={Trash}
        disabled
        testID="contacts-address-detail-delete"
        lx={{ flex: 1 }}
      >
        {labels.delete}
      </Button>
    </Box>
  );
}
