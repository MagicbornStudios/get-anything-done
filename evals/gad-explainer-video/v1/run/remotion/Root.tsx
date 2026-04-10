import { Composition } from "remotion";
import { GadExplainer } from "./GadExplainer";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="gad-explainer"
        component={GadExplainer}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
