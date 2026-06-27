import { Helmet } from "react-helmet-async";
import MarketingCommandCenterApp from "../components/MarketingCommandCenter";

export default function MarketingCommandCenter() {
  return (
    <>
      <Helmet>
        <title>D3VONN Marketing Command Center | DEVONN.AI</title>
        <meta
          name="description"
          content="D3VONN Marketing Command Center for campaign assets, brand review, claim governance, launch workflows, and reusable marketing operations."
        />
        <link rel="canonical" href="https://d3vonn.io/marketing" />
      </Helmet>
      <MarketingCommandCenterApp />
    </>
  );
}
