import Navbar from "./Navbar";
import DMForm from "./DMForm";

function App() {
  return (
    <>
      <div className="flex">
        <Navbar />
        <main className="flex-1 flex items-center justify-center min-h-screen bg-gray-50">
          <DMForm />
        </main>
      </div>
    </>
  );
}

export default App;
