import { Composition } from "remotion";
import { GadExplainer } from "./GadExplainer";

/**
 * Remotion composition registry. Each <Composition> registers a video
 * that can be rendered via `npx remotion render` or embedded via
 * `@remotion/player` on the /videos route.
 *
 * Per gad-57: 30s max, cinematic passthrough, stoppable.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="gad-explainer"
        component={GadExplainer}
        durationInFrames={30 * 30} // 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
