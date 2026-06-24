// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VaultPointer
 * @notice Smart contract để quản lý IPFS CID pointer cho Web3 Password Manager DApp
 * @dev Lưu trữ Content Identifier (CID) của vault đã mã hóa trên IPFS cho mỗi user
 */
contract VaultPointer {
    /// @dev Struct chứa CID IPFS và timestamp cập nhật cuối cùng
    struct VaultData {
        string cid;
        uint256 updatedAt;
    }

    /// @dev Mapping từ địa chỉ ví người dùng đến VaultData của họ
    mapping(address => VaultData) private userVaults;

    /// @dev Event phát ra khi user cập nhật vault pointer
    event VaultUpdated(address indexed user, string cid, uint256 timestamp);

    /**
     * @notice Cập nhật CID pointer cho vault của người gọi hàm
     * @dev Sử dụng `calldata` để tiết kiệm gas. Tự động ghi lại msg.sender để tăng bảo mật.
     * @param _cid IPFS CID của vault đã mã hóa (không được để trống)
     * 
     * Requirements:
     * - `_cid` phải không được rỗng
     */
    function updateVaultPointer(string calldata _cid) external {
        require(bytes(_cid).length > 0, "VaultPointer: CID cannot be empty");
        
        userVaults[msg.sender] = VaultData({
            cid: _cid,
            updatedAt: block.timestamp
        });
        
        emit VaultUpdated(msg.sender, _cid, block.timestamp);
    }

    /**
     * @notice Lấy thông tin vault pointer cho một địa chỉ cụ thể
     * @dev Hàm view không tiêu tốn gas
     * @param _user Địa chỉ ví của người dùng
     * @return cid IPFS CID của vault đã mã hóa
     * @return updatedAt Timestamp lần cập nhật cuối cùng (UTC seconds)
     */
    function getVaultPointer(address _user) 
        external 
        view 
        returns (string memory cid, uint256 updatedAt) 
    {
        VaultData memory vault = userVaults[_user];
        return (vault.cid, vault.updatedAt);
    }
}
