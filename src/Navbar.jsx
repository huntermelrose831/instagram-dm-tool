import { FaPoo } from "react-icons/fa";
import { MdSendToMobile } from "react-icons/md";
import { RxHome } from "react-icons/rx";
import { IoSettingsSharp } from "react-icons/io5";

const Navbar = () => {
  return (
    <>
      <div
        className="fixed top-0 left-0 h-screen w-16 m-0
         flex flex-col

          bg-primary text-secondary shadow"
      >
        <SideBarIcon icon={<RxHome size="35" />} />
        <SideBarIcon icon={<MdSendToMobile size="35" />} />
        <SideBarIcon icon={<IoSettingsSharp size="35" />} />
        <SideBarIcon icon={<FaPoo size="35" />} />
      </div>
    </>
  );
};
const SideBarIcon = ({ icon, text = "tooltip" }) => (
  <div className="sidebar-icon">
    {icon}
    <span className="sidebar-tooltip"></span>
  </div>
);
export default Navbar;
