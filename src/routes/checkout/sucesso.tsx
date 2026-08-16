import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const SuccessPage = () => {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-center text-gray-700 mb-4">Sucesso no checkout!</h1>
      <p className="text-gray-600 mb-6">
        Sua compra foi realizada com sucesso. Aproveite seu produto!
      </p>
      <div className="flex justify-center mb-6">
        <Button size="lg">
          <Link to="/">Voltar à loja</Link>
        </Button>
      </div>
      <div className="flex justify-center mt-4">
        <a href="https://facebook.com/share" className="btn-google dark:bg-orange">
          Compartilhar no Facebook
        </a>
        <a href="https://twitter.com/share" className="btn-facebook dark:bg-blue-600">
          Compartilhar no Twitter
        </a>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/checkout/sucesso")({
  component: SuccessPage,
});
