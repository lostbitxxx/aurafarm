export function PetStatus({ downloadUrl }: { downloadUrl: string | null }) {
  return (
    <section className="pet-status" aria-label="Desktop pet">
      <div className="inventory-heading">
        <h2>Desktop pet</h2>
      </div>
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
