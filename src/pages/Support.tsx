import { 
    ContentLayout,
    Header,
    Box
 } from "@cloudscape-design/components";

export default function Remediation() {
  return (
    <ContentLayout>
      <Header variant="h1">Support</Header>
      <Box margin={{ vertical: "xs" }}>
        <p>This is the Support page. Let's see if we can add some tips here.</p>
      </Box>
    </ContentLayout>
  );
}