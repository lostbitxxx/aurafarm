export function PetStatus({
  downloadUrl,
  showHeading = true,
}: {
  downloadUrl: string | null;
  showHeading?: boolean;
}) {
  return (
    <section className="pet-status" aria-label="Desktop pet">
      {showHeading ? (
        <div className="inventory-heading">
          <h2>Desktop pet</h2>
        </div>
      ) : null}
      {downloadUrl ? (
        <a className="button" href={downloadUrl}>
          Download the Mac pet
        </a>
      ) : (
        <p>
          The desktop build is not published yet. An unsigned Mac app is blocked until you
          right-click it and choose Open.
        </p>
      )}
    </section>
  );
}
