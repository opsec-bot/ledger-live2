import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import React from "react";
import { Text } from "react-native";
import { render, screen } from "@tests/test-renderer";
import type { BottomSheetBackgroundTone } from "LLM/contexts/BottomSheetBackgroundContext";
import { useBottomSheetBackgroundTone } from "LLM/hooks/useBottomSheetBackgroundTone";
import QueuedDrawerBottomSheet from "../QueuedDrawerBottomSheet";
import QueuedDrawersContextProvider from "../QueuedDrawersContextProvider";

const statusGradientTones = ["error", "info", "success"] as const;

const mockBottomSheetProps: Array<{
  backgroundComponent?: React.FC<BottomSheetBackgroundProps> | null;
}> = [];

jest.mock("@ledgerhq/lumen-ui-rnative", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const actual = jest.requireActual("@ledgerhq/lumen-ui-rnative");

  return {
    ...actual,
    BottomSheet: ({
      backgroundComponent: BackgroundComponent,
      children,
    }: {
      backgroundComponent?: React.FC<BottomSheetBackgroundProps> | null;
      children: React.ReactNode;
    }) => {
      mockBottomSheetProps.push({ backgroundComponent: BackgroundComponent });
      const backgroundProps = { style: {} } as BottomSheetBackgroundProps;

      return (
        <View testID="mock-bottom-sheet">
          {BackgroundComponent ? <BackgroundComponent {...backgroundProps} /> : null}
          {children}
        </View>
      );
    },
  };
});

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useIsFocused: () => true,
}));

function renderQueuedDrawerBottomSheet(children: React.ReactNode) {
  return render(
    <QueuedDrawersContextProvider>
      <QueuedDrawerBottomSheet>{children}</QueuedDrawerBottomSheet>
    </QueuedDrawersContextProvider>,
  );
}

const ProvidedBackground: React.FC<BottomSheetBackgroundProps> = ({ style }) => {
  return <Text style={style}>Provided background</Text>;
};

function BackgroundToneRequester({ tone }: { tone?: BottomSheetBackgroundTone }) {
  useBottomSheetBackgroundTone(tone);

  return <Text>Background tone requester</Text>;
}

function expectNoStatusGradient() {
  statusGradientTones.forEach(tone => {
    expect(screen.queryByTestId(`bottom-sheet-status-gradient-${tone}`)).toBeNull();
  });
}

describe("QueuedDrawerBottomSheet background tone integration", () => {
  beforeEach(() => {
    mockBottomSheetProps.length = 0;
  });

  describe("defined tone requests", () => {
    it.each(statusGradientTones)(
      "GIVEN a component inside the bottom sheet WHEN it requests the %s tone THEN the matching background gradient is displayed in the same render pass",
      tone => {
        // GIVEN / WHEN
        renderQueuedDrawerBottomSheet(<BackgroundToneRequester tone={tone} />);

        // THEN
        const lastProps = mockBottomSheetProps[mockBottomSheetProps.length - 1];
        expect(lastProps.backgroundComponent).toBeDefined();
        expect(screen.getByTestId(`bottom-sheet-status-gradient-${tone}`)).toBeVisible();
      },
    );

    it("GIVEN a provided background WHEN content requests a tone THEN the provided background takes precedence", () => {
      render(
        <QueuedDrawersContextProvider>
          <QueuedDrawerBottomSheet backgroundComponent={ProvidedBackground}>
            <BackgroundToneRequester tone="success" />
          </QueuedDrawerBottomSheet>
        </QueuedDrawersContextProvider>,
      );

      const lastProps = mockBottomSheetProps[mockBottomSheetProps.length - 1];
      expect(lastProps.backgroundComponent).toBe(ProvidedBackground);
      expect(screen.getByText("Provided background")).toBeVisible();
      expectNoStatusGradient();
    });
  });

  describe("undefined tone requests", () => {
    it("GIVEN a component inside the bottom sheet WHEN it requests an undefined tone THEN no background gradient is displayed", () => {
      // GIVEN / WHEN
      renderQueuedDrawerBottomSheet(<BackgroundToneRequester tone={undefined} />);

      // THEN
      const lastProps = mockBottomSheetProps[mockBottomSheetProps.length - 1];
      expect(lastProps.backgroundComponent).toBeUndefined();
      expectNoStatusGradient();
    });
  });

  describe("request cleanup", () => {
    it("GIVEN a component requested a defined tone WHEN that component unmounts THEN the background gradient is cleared in the same render pass", () => {
      // GIVEN
      const { rerender } = renderQueuedDrawerBottomSheet(
        <BackgroundToneRequester tone="success" />,
      );
      expect(screen.getByTestId("bottom-sheet-status-gradient-success")).toBeVisible();

      // WHEN
      rerender(
        <QueuedDrawersContextProvider>
          <QueuedDrawerBottomSheet>{null}</QueuedDrawerBottomSheet>
        </QueuedDrawersContextProvider>,
      );

      // THEN
      const lastProps = mockBottomSheetProps[mockBottomSheetProps.length - 1];
      expect(lastProps.backgroundComponent).toBeUndefined();
      expectNoStatusGradient();
    });
  });

  describe("successive different tone requesters", () => {
    it("GIVEN a component requesting one tone unmounts and another requesting a different tone mounts THEN the background gradient switches to the new tone with no residual gradient in the same render pass", () => {
      // GIVEN
      const { rerender } = renderQueuedDrawerBottomSheet(
        <BackgroundToneRequester key="first" tone="success" />,
      );
      expect(screen.getByTestId("bottom-sheet-status-gradient-success")).toBeVisible();

      // WHEN
      rerender(
        <QueuedDrawersContextProvider>
          <QueuedDrawerBottomSheet>
            <BackgroundToneRequester key="second" tone="error" />
          </QueuedDrawerBottomSheet>
        </QueuedDrawersContextProvider>,
      );

      // THEN
      expect(screen.getByTestId("bottom-sheet-status-gradient-error")).toBeVisible();
      expect(screen.queryByTestId("bottom-sheet-status-gradient-success")).toBeNull();
      expect(screen.queryByTestId("bottom-sheet-status-gradient-info")).toBeNull();
    });
  });
});
