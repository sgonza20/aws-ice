import { ContentLayout, Header, Box, SpaceBetween, Container } from '@cloudscape-design/components';

const Home = () => (
  <ContentLayout>
    <SpaceBetween size="l">
      <Box textAlign="center">
        <img src="./src/components/Images/openscap-horizontal.png" alt="OpenSCAP Logo" style={{ width: '400px' }} />
      </Box>
      <Container>
        <Header variant="h2">Overview</Header>
        <p>
          Welcome to AWS - Instance Compliance Evaluation.
        </p>
      </Container>
      <Container>
        <Header variant="h2">Features</Header>
        <ul>
          <li>Automated OpenSCAP scans on EC2 instances</li>
          <li>Generate comprehensive compliance reports</li>
          <li>Identify and remediate security vulnerabilities</li>
          <li>Ensure compliance with industry standards</li>
        </ul>
      </Container>
    </SpaceBetween>
  </ContentLayout>
);

export default Home;
