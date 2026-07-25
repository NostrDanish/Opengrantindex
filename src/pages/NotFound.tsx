import { useSeoMeta } from "@unhead/react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

import { Layout } from "@/components/ogi/Layout";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useSeoMeta({
    title: "Not found — OpenGrantIndex",
    description:
      "The page you are looking for could not be found. Search the index of grants, fellowships and funding opportunities instead.",
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="font-display text-7xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
          Nothing indexed here
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          That page doesn't exist. If you were looking for a specific opportunity, try searching the
          index — or add it yourself.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/search">Search the index</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/submit">Submit an opportunity</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link to="/">Home</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
