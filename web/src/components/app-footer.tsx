// Required by the assessment: name + GitHub + LinkedIn in the footer.
// Update the constants below once before submission.
const AUTHOR = {
  name: "Vedant",
  github: "https://github.com/Vedant251002",
  linkedin: "https://www.linkedin.com/in/vedantpandya25",
};

export function AppFooter() {
  return (
    <footer className="app-footer" role="contentinfo">
      Built by <strong>{AUTHOR.name}</strong> ·{" "}
      <a href={AUTHOR.github} target="_blank" rel="noopener noreferrer">
        GitHub
      </a>{" "}
      ·{" "}
      <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">
        LinkedIn
      </a>
    </footer>
  );
}
