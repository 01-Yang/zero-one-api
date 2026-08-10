# ADR 0001: Separate the Public Site from the Console

Status: Accepted

## Decision

The zero-one brand homepage is a small React application, while the existing
Sub2API Vue application remains the complete User and Administrator Console.

## Consequences

The visual WebGL experience stays isolated from operational UI, no route
contains two frontend frameworks, and Sub2API routes, stores and permissions
remain unchanged. Public Site changes release in the edge image; Console
changes release in the Sub2API image.
