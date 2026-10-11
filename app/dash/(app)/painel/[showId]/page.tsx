import Painel from "@/components/dash/Painel";

export default function PaginaPainel({ params }: { params: { showId: string } }) {
  return <Painel showId={decodeURIComponent(params.showId)} />;
}
