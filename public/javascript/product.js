document.addEventListener("DOMContentLoaded", () => {
    const productModal = document.getElementById("productModal");
    const addProductBtn = document.getElementById("addProductBtn");
    const cancelModal = document.getElementById("cancelModal");
    const productForm = document.getElementById("productForm");

    // Open Modal
    addProductBtn.addEventListener("click", () => {
        productModal.classList.remove("hidden");
        productModal.classList.add("flex");
        setTimeout(() => {
            productModal.firstElementChild.classList.remove("opacity-0", "scale-95");
            productModal.firstElementChild.classList.add("opacity-100", "scale-100");
        }, 50);
    });

    // Close Modal
    cancelModal.addEventListener("click", () => {
        closeModal();
    });

    // Close Modal when clicking outside
    productModal.addEventListener("click", (e) => {
        if (e.target === productModal) {
            closeModal();
        }
    });

    // Close Modal Function
    function closeModal() {
        productModal.firstElementChild.classList.remove("opacity-100", "scale-100");
        productModal.firstElementChild.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            productModal.classList.remove("flex");
            productModal.classList.add("hidden");
            resetForm();
        }, 300); // Matches transition duration
    }

    // Reset Form
    function resetForm() {
        productForm.reset();
        document.getElementById("modalTitle").textContent = "Add New Product";
        document.getElementById("productId").value = ""; // Clear hidden ID field
    }
});

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/admin/product/add', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error adding product');
        }
        
        // Success handling
        alert('Product added successfully');
        location.reload(); // Reload to show new product
        
    } catch (error) {
        alert(error.message);
    }
});
