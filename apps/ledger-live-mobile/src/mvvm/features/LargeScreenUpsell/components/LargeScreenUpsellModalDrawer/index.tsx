import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, BottomSheetHeader, BottomSheetView } from "@ledgerhq/lumen-ui-rnative";
import { Platform, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import type { FeatureIntroViewModel } from "LLM/components/FeatureIntroLayout/types";
import QueuedDrawerBottomSheet from "LLM/components/QueuedDrawer/QueuedDrawerBottomSheet";
import { LargeScreenUpsellModalContent } from "../LargeScreenUpsellModalContent";
import type { LargeScreenUpsellDismissMethod } from "../../analytics";

const LARGE_SCREEN_UPSELL_MODAL_BACKGROUND_COLOR = "#101010";

const styles = StyleSheet.create({
  background: {
    backgroundColor: LARGE_SCREEN_UPSELL_MODAL_BACKGROUND_COLOR,
  },
});

function LargeScreenUpsellModalBackground({ style }: BottomSheetBackgroundProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, styles.background]}
      testID="large-screen-upsell-modal-background"
    />
  );
}

type LargeScreenUpsellModalDrawerProps = Readonly<{
  isOpen: boolean;
  onDismiss: (dismissMethod: LargeScreenUpsellDismissMethod) => void;
  featureIntroViewModel: FeatureIntroViewModel;
  bottomInset: number;
}>;

export function LargeScreenUpsellModalDrawer({
  isOpen,
  onDismiss,
  featureIntroViewModel,
  bottomInset,
}: LargeScreenUpsellModalDrawerProps) {
  const [hasRenderedContent, setHasRenderedContent] = useState(isOpen);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const lastExplicitDismissMethodRef = useRef<LargeScreenUpsellDismissMethod | null>(null);
  const hasReportedDismissRef = useRef(false);
  const hasActiveOpeningRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen) {
      setHasRenderedContent(true);
      hasReportedDismissRef.current = false;
      lastExplicitDismissMethodRef.current = null;
      hasActiveOpeningRef.current = true;
    }
  }, [isOpen]);

  const handleModalHide = useCallback(() => {
    if (!isOpenRef.current) {
      setHasRenderedContent(false);
      hasActiveOpeningRef.current = false;
    }
  }, []);

  const reportDismiss = useCallback(
    (dismissMethod: LargeScreenUpsellDismissMethod) => {
      if (!hasActiveOpeningRef.current || hasReportedDismissRef.current) {
        return;
      }

      hasReportedDismissRef.current = true;
      onDismiss(dismissMethod);
    },
    [onDismiss],
  );

  const handleHeaderClosePressed = useCallback(() => {
    lastExplicitDismissMethodRef.current = "close button";
    reportDismiss("close button");
  }, [reportDismiss]);

  const handleBackdropPress = useCallback(() => {
    lastExplicitDismissMethodRef.current = "outside tap";
    reportDismiss("outside tap");
  }, [reportDismiss]);

  const handleClose = useCallback(() => {
    if (lastExplicitDismissMethodRef.current) {
      lastExplicitDismissMethodRef.current = null;
      return;
    }

    reportDismiss("outside tap");
  }, [reportDismiss]);

  const shouldRenderContent = isOpen || hasRenderedContent;

  return (
    <QueuedDrawerBottomSheet
      key="large-screen-upsell-modal-drawer"
      isRequestingToBeOpened={isOpen}
      onClose={handleClose}
      onHeaderClosePressed={handleHeaderClosePressed}
      onBackdropPress={handleBackdropPress}
      onModalHide={handleModalHide}
      enableDynamicSizing
      backgroundComponent={LargeScreenUpsellModalBackground}
    >
      {shouldRenderContent ? (
        <BottomSheetView
          style={{
            paddingHorizontal: 0,
            paddingTop: 0,
            paddingBottom: Platform.OS === "ios" ? bottomInset : 0,
          }}
        >
          <Box testID="large-screen-upsell-modal-drawer">
            <BottomSheetHeader spacing />
            <LargeScreenUpsellModalContent viewModel={featureIntroViewModel} />
          </Box>
        </BottomSheetView>
      ) : null}
    </QueuedDrawerBottomSheet>
  );
}
