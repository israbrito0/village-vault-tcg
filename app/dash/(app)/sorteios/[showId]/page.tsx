import Sorteios from "@/components/dash/Sorteios";

export default function PaginaSorteios({ params }: { params: { showId: string } }) {
  return <Sorteios showId={decodeURIComponent(params.showId)} />;
}
