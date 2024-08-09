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
          setActiveHref(event.detail.href);
          navigate(event.detail.href);
        }
      }}
      items={[
        {
          type: "link",
          text: "Home",
          href: "/",
        },
        {
          type: "link",
          text: "Instances",
          href: "/instances",
        },
        {
          type: "link",
          text: "Remediation",
          href: "/remediation",
        },
        {
          type: "link",
          text: "Support",
          href: "/support",
        },
      ]}
    />
  );
}
