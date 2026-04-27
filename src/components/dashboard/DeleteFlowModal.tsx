import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  flowId: string;
  flowName: string;
  onClose: () => void;
  onDeleted: () => void;
};

const DeleteFlowModal = ({ flowId, flowName, onClose, onDeleted }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    const { error: deleteError } = await supabase.from("flows").delete().eq("id", flowId);
    if (deleteError) { setError(deleteError.message); setLoading(false); }
    else onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl p-6 w-full max-w-[380px] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl tracking-tight mb-1">Delete flow</h2>
        <p className="text-sm text-muted-foreground mb-1 mt-2">
          This will permanently delete <span className="font-medium text-foreground">{flowName}</span> and all its run history.
        </p>
        <p className="text-sm text-muted-foreground mb-6">This cannot be undone.</p>
        {error && <p className="text-sm text-destructive mb-3">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-border py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteFlowModal;
