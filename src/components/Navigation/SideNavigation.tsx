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
          text: "Instances",
          items: [
            { type: "link", text: "Home", href: "/instances" },
          ],
        },
        {
          type: "section",
          text: "Reports",
          items: [
            { type: "link", text: "Home", href: "/reports" },
          ],
        },
        {
          type: "section",
          text: "Support",
          items: [
            { type: "link", text: " Home", href: "/support" },
          ],
        },
      ]}
    />
  );
}
