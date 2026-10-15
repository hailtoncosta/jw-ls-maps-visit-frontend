import { Share2, MessageCircle, Smartphone, FileText, Download, Link2, QrCode, Copy, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { buildCardText } from "@/lib/shareCard";
import InternalShareDialog from "./InternalShareDialog";
import QrCodeImage from "./QrCodeImage";
import { hasPermission, canShareAddress } from "@/lib/permissions";
import { useAuth } from "@/lib/AuthContext";

const buildShareLink = (address) => {
  return `${window.location.origin}/s/${address.id}`;
};

export default function ShareAddressButton({ address, onShared }) {
  const [showQR, setShowQR] = useState(false);
  const [showInternalShare, setShowInternalShare] = useState(false);
  const { user } = useAuth();
  if (!canShareAddress(user, address)) return null;

  const textContent = buildCardText(address);
  const jsonContent = JSON.stringify(address, null, 2);
  const shareLink = buildShareLink(address);

  const shareViaWebAPI = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Compartilhar Cadastro",
          text: `Cadastro de ${address.name}`,
          url: shareLink,
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  const shareWhatsApp = (text) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareSMS = (text) => {
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
  };

  const saveJSON = () => {
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `endereco_${address.name || address.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copiado!");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-xl">
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={shareViaWebAPI}>
            <Link2 className="h-4 w-4 text-primary" />
            <span>Compartilhar Link</span>
          </DropdownMenuItem>
          {hasPermission(user, "action_share_internal") && (
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setShowInternalShare(true)}>
              <Users className="h-4 w-4 text-accent" />
              <span>Compartilhar Internamente</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>WhatsApp</DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => shareWhatsApp(textContent)}>
            <MessageCircle className="h-4 w-4 text-accent" />
            <span className="flex items-center gap-1.5">Texto <FileText className="h-3 w-3 text-muted-foreground" /></span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>SMS</DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => shareSMS(textContent)}>
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="flex items-center gap-1.5">Texto <FileText className="h-3 w-3 text-muted-foreground" /></span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Importar</DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setShowQR(true)}>
            <QrCode className="h-4 w-4 text-foreground" />
            <span>QR Code</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={copyLink}>
            <Copy className="h-4 w-4 text-foreground" />
            <span>Copiar Link</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={saveJSON}>
            <Download className="h-4 w-4 text-foreground" />
            <span>Salvar JSON</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Code de Importação</DialogTitle>
            <DialogDescription>
              Escaneie com a câmera do celular para importar este endereço.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <QrCodeImage value={shareLink} size={256} className="rounded-xl border border-border" />
            <Button variant="outline" className="gap-2 w-full rounded-xl" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InternalShareDialog address={address} open={showInternalShare} onOpenChange={setShowInternalShare} onShared={onShared} />
    </>
  );
}
