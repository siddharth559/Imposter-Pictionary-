type RulesModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <section className="rules-modal" role="dialog" aria-modal="true" aria-label="Rules">
        <div className="panel-heading">
          <h2>Rules</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close rules">
            X
          </button>
        </div>
        <p>One secret Imposter. Draw, guess, and accuse carefully.</p>
      </section>
    </div>
  )
}
