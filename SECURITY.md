# Security policy

SC300 Academy is a static, single-file study site and a set of lab instructions. It has no
server and no user accounts, and it stores progress only in your browser. The realistic
security problems are of three kinds, and all three are in scope.

## In scope

- **Lab instructions that leave something unsafe behind.** Examples: a step that creates
  standing privileged access, a Conditional Access exclusion, public access or an open
  management port that teardown does not remove, or a teardown that misses a billable
  resource. Given how the labs are used, these are the most important reports.
- **The site itself.** Script injection through rendered content, the service worker
  serving something it should not, or a way for one learner's data to reach another.
- **The verification tooling.** A check in `verify/` or a workflow in `.github/` that
  could be made to pass while the content it guards is wrong, or that runs untrusted input.

## Out of scope

Findings in Microsoft products belong with the Microsoft Security Response Center
(https://msrc.microsoft.com/report), not here.

## Reporting

Use GitHub's private vulnerability reporting on this repository (Security tab ->
Report a vulnerability). Please do not open a public issue for a lab that leaves a
tenant exposed until it is fixed.
