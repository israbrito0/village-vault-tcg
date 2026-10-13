import Corrida from "@/components/dash/Corrida";

export default function PaginaCorrida({ params }: { params: { showId: string } }) {
  return <Corrida showId={decodeURIComponent(params.showId)} />;
}
