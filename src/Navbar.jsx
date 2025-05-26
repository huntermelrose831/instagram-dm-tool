import { MdSendToMobile } from "react-icons/md";
import { FaCompass } from "react-icons/fa";
import { FaRectangleList } from "react-icons/fa6";
import { FaInbox } from "react-icons/fa";
import { MdAccountCircle } from "react-icons/md";
import { RxHome } from "react-icons/rx";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div className="fixed top-0 left-0 h-screen w-16 m-0 flex flex-col bg-primary text-secondary shadow">
      <SideBarIcon
        icon={
          <Link to="/">
            <RxHome size="35" />
          </Link>
        }
        text="Home"
      />
      <SideBarIcon
        icon={
          <Link to="/send-dm">
            <MdSendToMobile size="35" />
          </Link>
        }
        text="Send DM"
      />
      <SideBarIcon
        icon={
          <Link to="/targets">
            <FaRectangleList size="35" />
          </Link>
        }
        text="Targets"
      />
      <SideBarIcon
        icon={
          <Link to="/leads">
            <FaCompass size="35" />
          </Link>
        }
        text="Leads"
      />
      <SideBarIcon
        icon={
          <Link to="/inbox">
            <FaInbox size="35" />
          </Link>
        }
        text="Inbox"
      />
      <SideBarIcon
        icon={
          <Link to="/accounts">
            <MdAccountCircle size="35" />
          </Link>
        }
        text="Accounts"
      />
    </div>
  );
};
const SideBarIcon = ({ icon, text = "tooltip" }) => (
  <div className="sidebar-icon">
    {icon}
    <span className="sidebar-tooltip"></span>
  </div>
);
export default Navbar;
