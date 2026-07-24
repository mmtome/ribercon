import { redirect } from 'next/navigation';

/** A fila é a tela inicial. Login pronto, o vendedor cai direto no trabalho do dia. */
export default function Home() {
  redirect('/fila');
}
