import { TopNavigation } from "@cloudscape-design/components";
import { useAuthenticator } from "@aws-amplify/ui-react";

export default function CustomTopNavigation() {
  const { signOut, user } = useAuthenticator();

  return (
    <TopNavigation
      identity={{
        href: "/",
        title: "Instance Compliance Evaluation for AWS",
      }}
      utilities={[
        {
          type: "button",
          text: user?.signInDetails?.loginId,
        },
        {
          type: "button",
          text: "Sign out",
          onClick: () => signOut(),
        },
      ]}
    />
  );
}
