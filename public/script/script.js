// Toast notification function
function showToast(message, type = 'info') {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        toastContainer.style.display = 'flex';
        toastContainer.style.flexDirection = 'column';
        toastContainer.style.gap = '10px';
        document.body.appendChild(toastContainer);
    }

    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');

    let bgColor, borderColor, icon;
    switch (type) {
        case 'success':
            bgColor = '#15803d'; // green
            borderColor = '#15803d';
            icon = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i>';
            break;
        case 'error':
            bgColor = '#dc2626'; // red
            borderColor = '#dc2626';
            icon = '<i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i>';
            break;
        case 'info':
        default:
            bgColor = '#2563eb'; // blue
            borderColor = '#2563eb';
            icon = '<i class="fas fa-info-circle" style="margin-right: 8px;"></i>';
    }

    toast.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: ${bgColor};
        border-left: 4px solid ${borderColor};
        color: white;
        padding: 8px 16px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        max-width: 300px;
        width: 100%;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    toast.innerHTML = `
        <div style="display: flex; align-items: center; flex: 1; font-size: 14px;">
            ${icon}<span>${message}</span>
        </div>
        <button type="button" style="margin-left: 12px; background: none; border: none; color: white; font-size: 16px; cursor: pointer;" data-toast-id="${toastId}">
            &times;
        </button>
    `;

    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 100);

    // Close button
    const closeButton = toast.querySelector(`[data-toast-id="${toastId}"]`);
    closeButton.addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    });

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
}


// HEADER

// Close dropdowns when clicking outside
window.addEventListener('click', function (event) {
    const dropdowns = document.querySelectorAll('.dropdown-content');
    dropdowns.forEach(dropdown => {
        if (dropdown.classList.contains('show') && !event.target.closest('.dropdown')) {
            dropdown.classList.remove('show');
        }
    });
});

// Toggle dropdown visibility
function toggleDropdown(dropdownId) {
    event.stopPropagation(); // Prevent click from immediately closing the dropdown

    // Close all other dropdowns first
    const dropdowns = document.querySelectorAll('.dropdown-content');
    dropdowns.forEach(dropdown => {
        if (dropdown.id !== dropdownId && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    });

    // Toggle the selected dropdown
    document.getElementById(dropdownId).classList.toggle('show');
}

// Handle mobile menu
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');

    if (mobileMenu.classList.contains('show')) {
        closeMobileMenu();
    } else {
        mobileMenu.classList.add('show');
        overlay.classList.remove('hidden');
        // Prevent body scrolling when menu is open
        document.body.style.overflow = 'hidden';
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');

    mobileMenu.classList.remove('show');
    overlay.classList.add('hidden');
    // Restore body scrolling
    document.body.style.overflow = '';
}

async function updateCartBadge() {
    try {
        const res = await fetch('/cart/count');
        const data = await res.json();

        const badge = document.getElementById('cart-count-badge');
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (err) {
        console.error('Error updating cart badge:', err);
    }
}


updateCartBadge();


window.updateCartBadge = updateCartBadge;

function updateCartCounter(count) {
    const badge = document.getElementById('cart-count-badge');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}


async function updateWishlistBadge() {
    try {
        const res = await fetch('/wishlist/count');
        const data = await res.json();

        const badge = document.getElementById('wishlist-badge');
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (err) {
        console.error('Error updating Wishlist badge:', err);
    }
}

// Initial call when page loads
updateWishlistBadge();

// expose to call after "Add to Wishlist"
window.updateWishlistBadge = updateWishlistBadge;

function updateWishlistCounter(count) {
    const badge = document.getElementById('wishlist-badge');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}





// ADDRESS PAGE

let currentAddressId = "";

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
}


function openAddAddressModal() {
    document.getElementById("addressModalTitle").textContent = "Add Address";
    document.getElementById("addressId").value = "";
    document.getElementById("fullName").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("flat").value = "";
    document.getElementById("area").value = "";
    document.getElementById("pincode").value = "";
    document.getElementById("landmark").value = "";
    document.getElementById("city").value = "";
    document.getElementById("state").value = "";
    document.querySelector('input[name="addressType"][value="Home"]').checked = true;
    document.getElementById("isDefault").checked = false;
    document.getElementById("addressModal").classList.remove("hidden");
    document.getElementById("addressModal").classList.add("modal-visible");
    document.getElementById("fullName").focus();
    ["fullName", "phone", "flat", "area", "pincode", "landmark", "city", "state"].forEach((id) => {
        const errorEl = document.getElementById(`error-${id}`);
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.style.display = "none";
        }
    });
}

function openEditAddressModal(id, fullName, phone, flat, area, pincode, landmark, city, state, addressType, isDefault) {
    document.getElementById("addressModalTitle").textContent = "Edit Address";
    document.getElementById("addressId").value = id;
    document.getElementById("fullName").value = fullName;
    document.getElementById("phone").value = phone;
    document.getElementById("flat").value = flat;
    document.getElementById("area").value = area;
    document.getElementById("pincode").value = pincode;
    document.getElementById("landmark").value = landmark || "";
    document.getElementById("city").value = city;
    document.getElementById("state").value = state;
    document.querySelector(`input[name="addressType"][value="${addressType}"]`).checked = true;
    document.getElementById("isDefault").checked = isDefault === "true";
    document.getElementById("addressModal").classList.remove("hidden");
    document.getElementById("addressModal").classList.add("modal-visible");
    document.getElementById("fullName").focus();
    ["fullName", "phone", "flat", "area", "pincode", "landmark", "city", "state"].forEach((id) => {
        const errorEl = document.getElementById(`error-${id}`);
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.style.display = "none";
        }
    });
}

function closeAddressModal() {
    document.getElementById("addressModal").classList.add("hidden");
    document.getElementById("addressModal").classList.remove("modal-visible");
    ["fullName", "phone", "flat", "area", "pincode", "landmark", "city", "state"].forEach((id) => {
        const errorEl = document.getElementById(`error-${id}`);
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.style.display = "none";
        }
    });
}

function openDeleteAddressModal(id) {
    currentAddressId = id;
    document.getElementById("deleteAddressModal").classList.remove("hidden");
    document.getElementById("deleteAddressModal").classList.add("modal-visible");
}

function closeDeleteAddressModal() {
    document.getElementById("deleteAddressModal").classList.add("hidden");
    document.getElementById("deleteAddressModal").classList.remove("modal-visible");
    currentAddressId = "";
}

function confirmDeleteAddress() {
    fetch(`/address/delete/${currentAddressId}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.success) {
                showToast("Address deleted successfully", "success");
                document.querySelector(`.address-item[data-id="${currentAddressId}"]`).remove();
                if (!document.querySelector(".address-item")) {
                    document.getElementById("addressList").innerHTML =
                        '<p class="text-gray-500 italic">No addresses found. Add a new address to get started.</p>';
                }
            } else {
                showToast(data.message || "Failed to delete address", "error");
            }
            closeDeleteAddressModal();
        })
        .catch((err) => {
            console.error("Delete address error:", err);
            showToast("Failed to delete address", "error");
            closeDeleteAddressModal();
        });
}

function validateAddressForm() {
    let isValid = true;

    function setError(id, message) {
        const errorEl = document.getElementById(`error-${id}`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add("text-red-500", "text-sm");
            errorEl.style.display = "block";
        }
        isValid = false;
    }

    function clearError(id) {
        const errorEl = document.getElementById(`error-${id}`);
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.style.display = "none";
        }
    }

    ["fullName", "phone", "flat", "area", "pincode", "landmark", "city", "state"].forEach(clearError);

    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const flat = document.getElementById("flat").value.trim();
    const area = document.getElementById("area").value.trim();
    const pincode = document.getElementById("pincode").value.trim();
    const landmark = document.getElementById("landmark").value.trim();
    const city = document.getElementById("city").value.trim();
    const state = document.getElementById("state").value;
    const addressType = document.querySelector('input[name="addressType"]:checked');

    if (!fullName) {
        setError("fullName", "Full Name is required");
    } else if (fullName.length < 2) {
        setError("fullName", "Full Name must be at least 2 characters long");
    } else if (!/^[a-zA-Z\s.]+$/.test(fullName)) {
        setError("fullName", "Full Name can only contain letters, spaces, and periods");
    }

    if (!phone) {
        setError("phone", "Phone number is required");
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
        setError("phone", "Enter a valid 10-digit mobile number starting with 6-9");
    }

    if (!flat) {
        setError("flat", "Flat/House number is required");
    } else if (flat.length < 2) {
        setError("flat", "Flat/House number must be at least 2 characters");
    }

    if (!area) {
        setError("area", "Area/Street is required");
    } else if (area.length < 3) {
        setError("area", "Area/Street must be at least 3 characters");
    }

    if (!pincode) {
        setError("pincode", "Pincode is required");
    } else if (!/^\d{6}$/.test(pincode)) {
        setError("pincode", "Enter a valid 6-digit PIN code");
    }

    if (!city) {
        setError("city", "City is required");
    } else if (city.length < 2) {
        setError("city", "City must be at least 2 characters");
    } else if (!/^[a-zA-Z\s]+$/.test(city)) {
        setError("city", "City can only contain letters and spaces");
    }

    if (!state) {
        setError("state", "Please select a state");
    }

    if (!addressType) {
        showToast("Please select an address type", "error");
        isValid = false;
    }

    if (landmark && landmark.length < 3) {
        setError("landmark", "Landmark must be at least 3 characters if provided");
    }

    return isValid;
}

document.getElementById("addressForm").addEventListener("submit", function (e) {
    e.preventDefault();

    if (!validateAddressForm()) {
        showToast("Please fix the errors in the form", "error");
        return;
    }

    const id = document.getElementById("addressId").value;
    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const flat = document.getElementById("flat").value.trim();
    const area = document.getElementById("area").value.trim();
    const pincode = document.getElementById("pincode").value.trim();
    const landmark = document.getElementById("landmark").value.trim();
    const city = document.getElementById("city").value.trim();
    const state = document.getElementById("state").value;
    const addressType = document.querySelector('input[name="addressType"]:checked').value;
    const isDefault = document.getElementById("isDefault").checked;

    const addressData = {
        fullName,
        phone,
        flat,
        area,
        pincode,
        landmark,
        city,
        state,
        addressType,
        isDefault,
    };
    const method = id ? "PUT" : "POST";
    const url = id ? `/address/update/${id}` : "/address/add";

    fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(addressData),
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.success) {
                showToast(id ? "Address updated successfully" : "Address added successfully", "success");
                location.reload();
            } else {
                showToast(data.message || (id ? "Failed to update address" : "Failed to add address"), "error");
            }
            closeAddressModal();
        })
        .catch((err) => {
            console.error("Address save error:", err);
            showToast(id ? "Failed to update address" : "Failed to add address", "error");
            closeAddressModal();
        });
});

document.getElementById("addressModal").addEventListener("click", function (e) {
    if (e.target === this) {
        closeAddressModal();
    }
});

document.getElementById("deleteAddressModal").addEventListener("click", function (e) {
    if (e.target === this) {
        closeDeleteAddressModal();
    }
});

window.addEventListener("click", function (event) {
    const dropdowns = document.querySelectorAll(".dropdown-content");
    dropdowns.forEach((dropdown) => {
        if (dropdown.classList.contains("show") && !event.target.closest(".dropdown")) {
            dropdown.classList.remove("show");
        }
    });
});

function toggleDropdown(dropdownId) {
    event.stopPropagation();
    const dropdowns = document.querySelectorAll(".dropdown-content");
    dropdowns.forEach((dropdown) => {
        if (dropdown.id !== dropdownId && dropdown.classList.contains("show")) {
            dropdown.classList.remove("show");
        }
    });
    document.getElementById(dropdownId).classList.toggle("show");
}


//CART PAGE



