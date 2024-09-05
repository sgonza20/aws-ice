import * as React from "react";
import { useNavigate } from "react-router-dom";
import { SideNavigation } from "@cloudscape-design/components";

export default function CustomSideNavigation() {
  const navigate = useNavigate();
  const [activeHref, setActiveHref] = React.useState("/");

  return (
    <SideNavigation
      activeHref={activeHref}
      header={{ href: "/", text: "Home" }}
      onFollow={(event) => {
        if (!event.detail.external) {
          event.preventDefault();
          const href = event.detail.href;
          setActiveHref(href);
          navigate(href);
        }
      }}
      items={[
        {
          type: "section",
          text: "Scan",
          items: [
            { type: "link", text: "Scan by Instance", href: "/instances" },
            {
              type: "link",
              text: "Scan by Platform",
              href: "/instancesPlatform",
            },
          ],
        },
        {
          type: "section",
          text: "Reports",
          items: [
            { type: "link", text: "Findings by Instance", href: "/reports" },
          ],
        },
        {
          type: "section",
          text: "Support",
          items: [{ type: "link", text: " Home", href: "/support" }],
        },
      ]}
    />
  );
}
