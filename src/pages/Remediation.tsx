import { 
    ContentLayout,
    Header,
    Box
 } from "@cloudscape-design/components";

export default function Remediation() {
  return (
    <ContentLayout>
      <Header variant="h1">Remediation</Header>
      <Box margin={{ vertical: "xs" }}>
        <p>This is the Remediation page where you can manage remediation tasks.</p>
      </Box>
    </ContentLayout>
  );
}
