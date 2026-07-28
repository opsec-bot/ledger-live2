import React from "react";
import { CryptoIcon } from "@ledgerhq/crypto-icons";
import { Box, Tag, Text } from "@ledgerhq/lumen-ui-rnative";
import { resolveContactAddressIconProps } from "../../model/resolveContactAddressIcon";
import type { ContactAddressDetailDialogProps } from "./types";

const ADDRESS_ICON_SIZE = 64;

type ContactAddressDetailSummaryProps = Readonly<{
  row: NonNullable<ContactAddressDetailDialogProps["row"]>;
  network: NonNullable<ContactAddressDetailDialogProps["network"]>;
  formatNetworkTag: ContactAddressDetailDialogProps["labels"]["formatNetworkTag"];
}>;

export function ContactAddressDetailSummary({
  row,
  network,
  formatNetworkTag,
}: ContactAddressDetailSummaryProps): React.JSX.Element {
  const iconProps = resolveContactAddressIconProps(
    row.currencyId,
    row.label,
    network.networkId,
  );

  return (
    <Box lx={{ alignItems: "center", gap: "s32" }}>
      <CryptoIcon
        ledgerId={iconProps.ledgerId}
        ticker={iconProps.ticker}
        network={iconProps.network}
        size={ADDRESS_ICON_SIZE}
        shape="circle"
      />
      <Box lx={{ alignItems: "center", gap: "s8" }}>
        <Tag
          appearance="gray"
          size="sm"
          label={formatNetworkTag(network.networkName)}
          testID="contacts-address-detail-network-tag"
        />
        <Box lx={{ alignItems: "center", gap: "s4" }}>
          <Text typography="heading3SemiBold" lx={{ color: "base", textAlign: "center" }}>
            {row.label}
          </Text>
          <Text
            typography="body2"
            lx={{ color: "muted", textAlign: "center" }}
            testID="contacts-address-detail-full-address"
          >
            {row.address}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
